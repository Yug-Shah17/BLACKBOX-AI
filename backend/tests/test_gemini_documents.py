"""Hosted QA contracts use mocked transport, never a real key or quota."""

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError

from backend.app.services import gemini
from backend.app.services.documents import answer_checks, GEMINI_VERSION

from fastapi.testclient import TestClient

from backend.app.main import create_app


class GeminiDocumentTests(unittest.TestCase):
    def test_malformed_recorded_evidence_fails_closed(self):
        selected = {"documentId": "source", "current": True, "text": "A verified sentence."}
        generated = {"answer": "A verified sentence.", "citation": "source"}
        for evidence in ([], "bad", 3, {"answer": "A verified sentence.", "supported": True, "quotes": "bad"}):
            with self.subTest(evidence=evidence):
                self.assertFalse(answer_checks("Question", selected, generated,
                                              {"answerEvidence": evidence}, GEMINI_VERSION))

    def setUp(self):
        directory = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        self.addCleanup(directory.cleanup)
        self.client = TestClient(create_app(data_dir=Path(directory.name),
                                           fixture_path=Path(directory.name) / "absent.json"))
        self.addCleanup(self.client.close)
        self.payload = {"question": "Who can participate?", "answeringMode": "gemini",
                        "allowExternalProcessing": True, "documents": [{
                            "documentId": "notes", "title": "Notes", "topic": "event",
                            "text": "Second-year students may participate.", "current": True}]}

    def test_external_processing_requires_consent(self):
        self.payload["allowExternalProcessing"] = False
        response = self.client.post("/document-runs", json=self.payload)
        self.assertEqual(response.status_code, 422)
        self.assertIn("consent", response.text.lower())

    def test_answer_evidence_and_replay_preserve_original(self):
        result = {"answer": "Second-year students can participate.",
                  "quotes": ["Second-year students may participate."], "supported": True}
        with patch("backend.app.services.documents.gemini.answer", return_value=result) as provider:
            response = self.client.post("/document-runs", json=self.payload)
            self.assertEqual(response.status_code, 201)
            run = response.json()
            self.assertEqual(run["outcome"], "success")
            self.assertEqual(run["schemaVersion"], "document-qa-gemini-v1")
            self.assertEqual(run["steps"][2]["outputData"]["answer"], result["answer"])
            url = f"/document-runs/{run['runId']}"
            self.assertEqual(self.client.get(url).status_code, 200)
            bad = self.client.post(url + "/replay", json={"checkpointStep": 3,
                "alternativeAction": {"type": "replace_output", "output": {
                    "answer": "Everyone can participate.", "citation": "notes"}}})
            self.assertEqual(bad.status_code, 201)
            self.assertEqual(bad.json()["replayOutcome"], "failed")
            self.assertEqual(provider.call_count, 1, "Manual generation replacement must not use quota")
            self.assertEqual(self.client.get(url).json(), run)

    def test_missing_answer_and_fabricated_quotes(self):
        results = [("The document does not contain this answer.", [], False, "success"),
                   ("Everyone qualifies.", ["Everyone qualifies."], True, "failed")]
        for answer, quotes, supported, outcome in results:
            with self.subTest(outcome=outcome), patch("backend.app.services.documents.gemini.answer",
                    return_value={"answer": answer, "quotes": quotes, "supported": supported}):
                run = self.client.post("/document-runs", json=self.payload).json()
                self.assertEqual(run["outcome"], outcome)
                self.assertEqual(self.client.get(f"/document-runs/{run['runId']}").status_code, 200)

    def test_word_counts_do_not_call_provider(self):
        self.payload["question"] = "How many times is the word students repeated?"
        with patch("backend.app.services.documents.gemini.answer") as provider:
            run = self.client.post("/document-runs", json=self.payload).json()
            self.assertEqual(run["outcome"], "success")
            self.assertIn('"students" appears 1 times', run["steps"][2]["outputData"]["answer"])
            provider.assert_not_called()

    def test_provider_failure_is_recorded_and_diagnosable(self):
        with patch("backend.app.services.documents.gemini.answer",
                   side_effect=gemini.ProviderError("QUOTA_EXCEEDED", "Free quota exhausted.")):
            run = self.client.post("/document-runs", json=self.payload).json()
            self.assertEqual(run["outcome"], "failed")
            self.assertEqual(run["steps"][2]["error"]["code"], "QUOTA_EXCEEDED")
            url = f"/document-runs/{run['runId']}"
            self.assertEqual(self.client.get(url).status_code, 200)
            diagnosis = self.client.post(url + "/diagnose").json()
            self.assertEqual(diagnosis["predictedFailureStep"], 3)
            self.assertIn("Free quota exhausted.", diagnosis["evidence"])

    def test_quota_errors_do_not_retry_or_leak_provider_details(self):
        with patch.object(gemini, "api_key", return_value="test-secret"), patch.object(gemini, "urlopen",
                side_effect=HTTPError("https://example.test", 429, "test-secret", {}, None)) as transport:
            with self.assertRaises(gemini.ProviderError) as raised:
                gemini.answer("Question", self.payload["documents"][0])
            self.assertEqual(raised.exception.code, "QUOTA_EXCEEDED")
            self.assertNotIn("test-secret", str(raised.exception))
            self.assertEqual(transport.call_count, 1)

    def test_generation_override_can_use_literal_source_without_provider(self):
        result = {"answer": "Second-year students qualify.",
                  "quotes": ["Second-year students may participate."], "supported": True}
        self.payload["failureType"] = "unsupported_answer"
        with patch("backend.app.services.documents.gemini.answer", return_value=result) as provider:
            original = self.client.post("/document-runs", json=self.payload).json()
            self.assertEqual(original["outcome"], "failed")
            url = f"/document-runs/{original['runId']}"
            branch = self.client.post(url + "/replay", json={"checkpointStep": 3,
                "alternativeAction": {"type": "replace_output", "output": {
                    "answer": self.payload["documents"][0]["text"], "citation": "notes"}}})
            self.assertEqual(branch.status_code, 201)
            self.assertEqual(branch.json()["replayOutcome"], "success")
            self.assertEqual(provider.call_count, 1)
            self.assertEqual(self.client.get(url).json(), original)
