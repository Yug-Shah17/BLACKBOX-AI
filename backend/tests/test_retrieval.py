"""Offline ranking and recorded-version compatibility checks."""

import copy
import json
import unittest
from pathlib import Path

from backend.app.services import documents
from ml.evaluate_retrieval import evaluate


class RetrievalTests(unittest.TestCase):
    def test_checked_in_measurements_reproduce(self):
        root = Path(__file__).resolve().parents[2] / "ml"
        for version, filename in ((documents.PREVIOUS_VERSION, "retrieval_baseline.json"),
                                  (documents.VERSION, "retrieval_improved.json")):
            with self.subTest(version=version):
                self.assertEqual(evaluate(version), json.loads((root / filename).read_text(encoding="utf-8")))

    def test_legacy_replay_retains_topic_overlap_and_supplied_order(self):
        config = documents.DocumentRequest(question="What is the returns policy?", documents=[
            {"documentId": "privacy", "title": "Privacy", "topic": "privacy policy", "text": "Private."},
            {"documentId": "returns", "title": "Returns", "topic": "returns policy", "text": "Thirty days."},
        ]).model_dump()
        for version in (documents.LEGACY_VERSION, documents.PREVIOUS_VERSION):
            with self.subTest(version=version):
                original, snapshots = documents.execute(config, version=version)
                before = copy.deepcopy(original)
                checkpoint = next(value for value in snapshots.values() if value["stepIndex"] == 0)
                replay, _ = documents.execute(config, checkpoint=checkpoint, prefix=[])
                self.assertEqual(original, before)
                self.assertEqual(replay["public"]["schemaVersion"], version)
                self.assertEqual(replay["public"]["steps"][0]["outputData"]["documentIds"], ["privacy", "returns"])
                self.assertEqual(replay["public"]["steps"][1]["outputData"]["documentId"], "privacy")
        current, _ = documents.execute(config)
        self.assertEqual(current["public"]["steps"][0]["outputData"]["documentIds"], ["returns", "privacy"])
        self.assertEqual(current["public"]["steps"][1]["outputData"]["documentId"], "returns")

    def test_count_and_gemini_paths_keep_all_documents(self):
        sources = [item.model_dump() for item in documents.default_documents()]
        self.assertEqual(documents.retrieve('Count occurrences of "absent".', sources), ["current", "archived"])
        self.assertEqual(documents.retrieve("Unrelated question", sources, documents.GEMINI_VERSION), ["current", "archived"])

    def test_unrelated_and_stopword_only_queries_abstain(self):
        sources = [item.model_dump() for item in documents.default_documents()]
        for question in ("The and is of?", "Quantum entanglement?"):
            self.assertEqual(documents.retrieve(question, sources), [])

    def test_archived_evidence_remains_available_but_is_not_selected(self):
        config = documents.DocumentRequest(documents=list(reversed(documents.default_documents()))).model_dump()
        record, _ = documents.execute(config)
        steps = record["public"]["steps"]
        self.assertIn("archived", steps[0]["outputData"]["documentIds"])
        self.assertEqual(steps[1]["outputData"]["documentId"], "current")


if __name__ == "__main__":
    unittest.main()
