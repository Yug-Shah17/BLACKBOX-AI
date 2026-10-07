"""Document execution and checkpoint replay contracts."""

import copy
import json
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from backend.app.main import create_app


class DocumentTests(unittest.TestCase):
    def test_word_count_question_and_replay(self):
        source = {"documentId": "notes", "title": "notes.txt", "topic": "values",
                  "text": "Integrity, integrity! INTEGRITY. Integrities and disintegrity.", "current": True}
        question = "how many times was the word Integrity repeated"
        payload = {"question": question, "documents": [source]}
        run = self.client.post("/document-runs", json=payload).json()
        answer = 'The word "Integrity" appears 3 times in the selected document (case-insensitive, whole-word matches).'
        self.assertEqual(run["steps"][2]["outputData"]["answer"], answer)
        self.assertEqual(run["outcome"], "success")
        url = f"/document-runs/{run['runId']}"
        self.assertEqual(self.client.get(url).status_code, 200)
        self.assertIsNone(self.client.post(f"{url}/diagnose").json()["predictedFailureStep"])
        bad = self.client.post(f"{url}/replay", json={"checkpointStep": 3,
            "alternativeAction": {"type": "replace_output", "output": {
                "answer": source["text"], "citation": "notes"}}}).json()
        self.assertEqual(bad["replayOutcome"], "failed")
        branch_url = f"/document-runs/{bad['replayRunId']}"
        self.assertEqual(self.client.post(f"{branch_url}/diagnose").json()["predictedFailureStep"], 3)
        corrected = self.client.post(f"{branch_url}/replay", json={"checkpointStep": 3,
            "alternativeAction": {"type": "replace_output", "output": {
                "answer": answer, "citation": "notes"}}}).json()
        self.assertEqual(corrected["replayOutcome"], "success")

    def test_word_count_zero_and_supported_question_forms(self):
        source = {"documentId": "notes", "title": "notes.txt", "topic": "values",
                  "text": "Respect, respect. Respectful is different.", "current": True}
        for question, word, count in [("How many times does 'respect' appear?", "respect", 2),
                                       ('Count occurrences of "respect".', "respect", 2),
                                       ("How often is the word integrity mentioned?", "integrity", 0),
                                       ("Give me the number of times 'respect' was repeated.", "respect", 2),
                                       ("Number of times the word integrity appears?", "integrity", 0)]:
            with self.subTest(question=question):
                run = self.client.post("/document-runs", json={"question": question, "documents": [source]}).json()
                self.assertIn(f'"{word}" appears {count} times', run["steps"][2]["outputData"]["answer"])
                self.assertEqual(run["outcome"], "success")

    def test_legacy_word_count_trace_remains_readable(self):
        from backend.app.services import documents
        config = documents.DocumentRequest(question="How many times was the word returns repeated").model_dump()
        record, checkpoints = documents.execute(config, version="document-qa-v1")
        self.client.app.state.document_store.save(record, checkpoints)
        url = f"/document-runs/{record['public']['runId']}"
        self.assertEqual(self.client.get(url).status_code, 200)
        replay = self.client.post(f"{url}/replay", json={"checkpointStep": 3,
            "alternativeAction": {"type": "replace_output", "output": {
                "answer": "Returns are accepted within 30 days.", "citation": "current"}}})
        self.assertEqual(replay.status_code, 201)
        self.assertEqual(self.client.get(f"/document-runs/{replay.json()['replayRunId']}").json()["schemaVersion"], "document-qa-v1")

    def test_uploaded_sources_record_replay_and_preserve_original(self):
        sources = [
            {"documentId": "upload-old", "title": "archive.md", "topic": "returns policy",
             "text": "# Returns policy\nReturns accepted within 7 days.", "current": False},
            {"documentId": "upload-new", "title": "current.txt", "topic": "returns policy",
             "text": "Returns accepted within 30 days.", "current": True},
        ]
        payload = {"question": "What is the returns policy?", "documents": sources}
        healthy = self.client.post("/document-runs", json=payload)
        self.assertEqual(healthy.status_code, 201)
        self.assertEqual(healthy.json()["outcome"], "success")
        payload["failureType"] = "wrong_source"
        original = self.client.post("/document-runs", json=payload).json()
        url = f"/document-runs/{original['runId']}"
        self.assertEqual(self.client.post(f"{url}/diagnose").json()["predictedFailureStep"], 2)
        replay = self.client.post(f"{url}/replay", json={"checkpointStep": 2,
            "alternativeAction": {"type": "replace_output", "output": {"documentId": "upload-new"}}})
        self.assertEqual(replay.status_code, 201)
        self.assertEqual(replay.json()["replayOutcome"], "success")
        self.assertEqual(self.client.get(f"{url}/sources").json()["documents"], sources)
        self.assertEqual(self.client.get(url).json(), original)
        comparison = self.client.get(f"{url}/compare", params={"replay": replay.json()["replayRunId"]})
        self.assertEqual(comparison.status_code, 200)
        self.assertEqual(comparison.json()["originalOutcome"], "failed")
        self.assertEqual(comparison.json()["replayOutcome"], "success")

    def test_demo_scenarios_are_executable_and_correctable(self):
        response = self.client.get("/document-scenarios")
        self.assertEqual(response.status_code, 200)
        scenarios = response.json()
        self.assertEqual(len(scenarios), 3)
        for scenario in scenarios:
            with self.subTest(scenario=scenario["id"]):
                self.assertEqual(scenario["dataSource"], "fictional-demo")
                payload = {"question": scenario["question"], "documents": scenario["documents"]}
                healthy = self.client.post("/document-runs", json=payload)
                self.assertEqual(healthy.status_code, 201)
                self.assertEqual(healthy.json()["outcome"], "success")
                self.assertEqual(healthy.json()["steps"][2]["outputData"]["answer"], scenario["expectedAnswer"])
                payload["failureType"] = "wrong_source"
                failed = self.client.post("/document-runs", json=payload).json()
                self.assertEqual(failed["outcome"], "failed")
                replay = self.client.post(f"/document-runs/{failed['runId']}/replay", json={
                    "checkpointStep": 2, "alternativeAction": {"type": "replace_output",
                    "output": {"documentId": scenario["expectedCitation"]}}})
                self.assertEqual(replay.status_code, 201)
                self.assertEqual(replay.json()["replayOutcome"], "success")

    def test_scenario_benchmark_reports_bounded_rule_results(self):
        from scripts.document_benchmark import evaluate
        report = evaluate()
        self.assertEqual(report["diagnosisMode"], "rules")
        self.assertEqual(report["dataSource"], "fictional-demo")
        self.assertEqual(report["caseCount"], 12)
        self.assertEqual(report["healthyCaseCount"], 3)
        for case in report["cases"]:
            with self.subTest(scenario=case["scenario"], fault=case["fault"]):
                self.assertEqual(case["predictedStep"], case["expectedStep"])
                self.assertEqual(case["correctedOutcome"], "success")
                self.assertEqual(case["wrongCorrectionOutcome"], "failed")
                self.assertTrue(case["originalPreserved"])

    def test_source_context_survives_failed_retrieval_without_fault_labels(self):
        run = self.client.post("/document-runs", json={"failureType": "missing_retrieval"}).json()
        response = self.client.get(f"/document-runs/{run['runId']}/sources")
        self.assertEqual(response.status_code, 200)
        context = response.json()
        self.assertEqual(context["question"], "What is the returns policy?")
        self.assertEqual([item["documentId"] for item in context["documents"]], ["current", "archived"])
        self.assertNotIn("failureType", context)
        self.assertEqual(self.client.get("/document-runs/missing/sources").status_code, 404)

    def test_document_evaluation_is_distinct_and_missing_report_is_explicit(self):
        from scripts.document_benchmark import evaluate
        path = self.directory / "document-report.json"
        self.client.app.state.document_metrics_path = path
        self.assertEqual(self.client.get("/document-evaluation").status_code, 503)

        report = evaluate()
        path.write_text(json.dumps(report), encoding="utf-8")
        response = self.client.get("/document-evaluation")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["diagnosisMode"], "rules")
        self.assertEqual(response.json()["caseCount"], 12)
        report["diagnosisMode"] = "learned"
        path.write_text(json.dumps(report), encoding="utf-8")
        self.assertEqual(self.client.get("/document-evaluation").status_code, 503)

    def test_readiness_checks_document_storage(self):
        self.client.post("/document-runs", json={})
        path = self.directory / "documents" / "state.json"
        path.write_text("not json", encoding="utf-8")
        self.assertEqual(self.client.get("/health").status_code, 200)
        self.assertEqual(self.client.get("/ready").status_code, 503)

    def test_document_evaluation_rejects_stale_scenario_fingerprint(self):
        from scripts.document_benchmark import evaluate
        path = self.directory / "stale-document-report.json"
        self.client.app.state.document_metrics_path = path
        report = evaluate()
        report["scenarioSha256"] = "0" * 64
        path.write_text(json.dumps(report), encoding="utf-8")
        self.assertEqual(self.client.get("/document-evaluation").status_code, 503)

    def test_document_evaluation_rejects_inconsistent_or_malformed_cases(self):
        from scripts.document_benchmark import evaluate
        original = evaluate()
        path = self.directory / "inconsistent-document-report.json"
        self.client.app.state.document_metrics_path = path
        mutations = [
            lambda report: report.update(top1Localization=0.5),
            lambda report: report["cases"].__setitem__(0, {}),
            lambda report: report["cases"].__setitem__(0, copy.deepcopy(report["cases"][1])),
            lambda report: report["cases"][0].update(executedSteps=[4]),
            lambda report: report["cases"][0].update(expectedStep=3),
        ]
        for index, mutate in enumerate(mutations):
            with self.subTest(mutation=index):
                report = copy.deepcopy(original)
                mutate(report)
                path.write_text(json.dumps(report), encoding="utf-8")
                before = path.read_bytes()
                self.assertEqual(self.client.get("/document-evaluation").status_code, 503)
                self.assertEqual(path.read_bytes(), before)

    def test_rule_diagnosis_requires_only_recorded_observations(self):
        from backend.app.services.documents import diagnose
        for fault in ("wrong_source", "unsupported_answer", "incorrect_citation"):
            with self.subTest(fault=fault):
                run = self.client.post("/document-runs", json={"failureType": fault}).json()
                record = self.client.app.state.document_store.get(run["runId"])
                expected = diagnose(record)
                record.pop("config")
                self.assertEqual(diagnose(record), expected)
                if fault == "wrong_source":
                    self.assertTrue(any("archived" in item.lower() for item in expected["evidence"]))

    def test_corrupt_execution_config_cannot_be_replayed(self):
        run = self.client.post("/document-runs", json={"failureType": "wrong_source"}).json()
        path = self.directory / "documents" / "state.json"
        state = json.loads(path.read_text())
        state["runs"][run["runId"]]["config"] = {}
        for snapshot in state["checkpoints"].values():
            snapshot["config"] = {}
        path.write_text(json.dumps(state), encoding="utf-8")
        before = path.read_bytes()
        result = self.client.post(f"/document-runs/{run['runId']}/replay", json={
            "checkpointStep": 2, "alternativeAction": {"type": "replace_output", "output": {"documentId": "current"}}})
        self.assertEqual(result.status_code, 409)
        self.assertEqual(path.read_bytes(), before)

    def test_corrupt_document_topology_cannot_be_diagnosed_or_replayed(self):
        run = self.client.post("/document-runs", json={"failureType": "wrong_source"}).json()
        path = self.directory / "documents" / "state.json"
        saved = json.loads(path.read_text())
        mutations = [
            lambda public: public.update(steps=[]),
            lambda public: public["steps"].reverse(),
            lambda public: public["steps"][0].update(outputData=None),
            lambda public: public.update(schemaVersion="document-qa-unknown"),
        ]
        for index, mutate in enumerate(mutations):
            with self.subTest(mutation=index):
                state = copy.deepcopy(saved)
                mutate(state["runs"][run["runId"]]["public"])
                path.write_text(json.dumps(state), encoding="utf-8")
                before = path.read_bytes()
                url = f"/document-runs/{run['runId']}"
                self.assertEqual(self.client.post(url + "/diagnose").status_code, 409)
                self.assertEqual(self.client.post(url + "/replay", json={
                    "checkpointStep": 2, "alternativeAction": {"type": "replace_output",
                    "output": {"documentId": "current"}}}).status_code, 409)
                self.assertEqual(path.read_bytes(), before)

    def test_corrupt_suffix_observations_and_checkpoint_ids_reject_early_replay(self):
        run = self.client.post("/document-runs", json={"failureType": "unsupported_answer"}).json()
        path = self.directory / "documents" / "state.json"
        saved = json.loads(path.read_text())
        mutations = [
            lambda public: public["steps"][2]["outputData"].update(answer={}),
            lambda public: public["steps"][3]["outputData"].update(passed=True),
            lambda public: public["steps"][2].pop("checkpointId"),
            lambda public: public["steps"][2].update(checkpointId=None),
        ]
        for index, mutate in enumerate(mutations):
            with self.subTest(mutation=index):
                state = copy.deepcopy(saved)
                mutate(state["runs"][run["runId"]]["public"])
                path.write_text(json.dumps(state), encoding="utf-8")
                before = path.read_bytes()
                url = f"/document-runs/{run['runId']}"
                self.assertEqual(self.client.post(url + "/diagnose").status_code, 409)
                for step, output in ((1, {"documentIds": ["current", "archived"]}),
                                     (3, {"answer": "Returns are accepted within 30 days.", "citation": "current"})):
                    self.assertEqual(self.client.post(url + "/replay", json={
                        "checkpointStep": step, "alternativeAction": {"type": "replace_output", "output": output}}).status_code, 409)
                self.assertEqual(path.read_bytes(), before)

    def test_healthy_trace_with_changed_outcome_does_not_invent_evidence(self):
        run = self.client.post("/document-runs", json={}).json()
        path = self.directory / "documents" / "state.json"
        state = json.loads(path.read_text())
        state["runs"][run["runId"]]["public"]["outcome"] = "failed"
        path.write_text(json.dumps(state), encoding="utf-8")
        self.assertEqual(self.client.post(f"/document-runs/{run['runId']}/diagnose").status_code, 409)

    def test_corrupt_later_checkpoint_rejects_earlier_replay(self):
        run = self.client.post("/document-runs", json={"failureType": "missing_retrieval"}).json()
        path = self.directory / "documents" / "state.json"
        state = json.loads(path.read_text())
        state["checkpoints"][run["steps"][3]["checkpointId"]]["state"] = {}
        path.write_text(json.dumps(state), encoding="utf-8")
        before = path.read_bytes()
        response = self.client.post(f"/document-runs/{run['runId']}/replay", json={
            "checkpointStep": 1, "alternativeAction": {"type": "replace_output",
            "output": {"documentIds": ["current", "archived"]}}})
        self.assertEqual(response.status_code, 409)
        self.assertEqual(path.read_bytes(), before)

    def setUp(self):
        temporary = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        self.addCleanup(temporary.cleanup)
        self.directory = Path(temporary.name)
        self.client = TestClient(create_app(data_dir=self.directory,
                                           fixture_path=self.directory / "absent.json"))
        self.addCleanup(self.client.close)

    def test_faults_diagnosis_and_replay(self):
        cases = [("missing_retrieval", 1, {"documentIds": ["current", "archived"]}),
                 ("wrong_source", 2, {"documentId": "current"}),
                 ("unsupported_answer", 3, {"answer": "Returns are accepted within 30 days.",
                                            "citation": "current"}),
                 ("incorrect_citation", 3, {"answer": "Returns are accepted within 30 days.",
                                            "citation": "current"})]
        for fault, step, output in cases:
            with self.subTest(fault=fault):
                response = self.client.post("/document-runs", json={"failureType": fault})
                self.assertEqual(response.status_code, 201)
                original = response.json()
                self.assertEqual(original["outcome"], "failed")
                url = f"/document-runs/{original['runId']}"
                diagnosis = self.client.post(url + "/diagnose").json()
                self.assertEqual(diagnosis["predictedFailureStep"], step)
                self.assertEqual(diagnosis["mode"], "rules")
                self.assertTrue(diagnosis["evidence"])
                replay = self.client.post(url + "/replay", json={"checkpointStep": step,
                    "alternativeAction": {"type": "replace_output", "output": output}})
                self.assertEqual(replay.status_code, 201)
                result = replay.json()
                self.assertEqual(result["replayOutcome"], "success")
                self.assertEqual(result["reusedSteps"], list(range(1, step)))
                self.assertEqual(result["executedSteps"], list(range(step, 5)))
                self.assertEqual(self.client.get(url).json(), original)
                comparison = self.client.get(url + "/compare", params={"replay": result["replayRunId"]})
                self.assertEqual(comparison.status_code, 200)
                self.assertEqual(comparison.json()["divergenceStep"], step)

    def test_custom_documents_and_healthy_diagnosis(self):
        payload = {"question": "What is the support email?", "documents": [
            {"documentId": "support", "title": "Support", "topic": "support email",
             "text": "Contact help@example.test.", "current": True}]}
        response = self.client.post("/document-runs", json=payload)
        self.assertEqual(response.status_code, 201)
        run = response.json()
        self.assertEqual(run["outcome"], "success")
        self.assertEqual(run["steps"][2]["outputData"]["answer"], "Contact help@example.test.")
        diagnosis = self.client.post(f"/document-runs/{run['runId']}/diagnose").json()
        self.assertIsNone(diagnosis["predictedFailureStep"])
        self.assertEqual(diagnosis["evidence"], [])

    def test_invalid_override_does_not_save(self):
        run = self.client.post("/document-runs", json={}).json()
        url = f"/document-runs/{run['runId']}/replay"
        for output in ({"answer": "invented"}, {"answer": "invented", "citation": "missing"}):
            response = self.client.post(url, json={"checkpointStep": 3,
                "alternativeAction": {"type": "replace_output", "output": output}})
            self.assertEqual(response.status_code, 422)
        self.assertEqual(len(self.client.get("/document-runs").json()), 1)

    def test_corrupt_checkpoint_rejected_and_branch_replay_supported(self):
        run = self.client.post("/document-runs", json={"failureType": "unsupported_answer"}).json()
        body = {"checkpointStep": 3, "alternativeAction": {"type": "replace_output", "output": {
            "answer": "Returns are accepted within 30 days.", "citation": "current"}}}
        url = f"/document-runs/{run['runId']}/replay"
        first = self.client.post(url, json=body)
        self.assertEqual(first.status_code, 201)
        branch = first.json()["replayRunId"]
        self.assertEqual(self.client.post(f"/document-runs/{branch}/replay", json=body).status_code, 201)
        path = self.directory / "documents" / "state.json"
        state = json.loads(path.read_text())
        state["checkpoints"][run["steps"][2]["checkpointId"]]["state"] = {}
        path.write_text(json.dumps(state), encoding="utf-8")
        before = path.read_bytes()
        self.assertEqual(self.client.post(url, json=body).status_code, 409)
        self.assertEqual(path.read_bytes(), before)

    def test_duplicate_documents_and_unknown_question(self):
        document = {"documentId": "x", "title": "Returns", "topic": "returns", "text": "30 days"}
        self.assertEqual(self.client.post("/document-runs", json={
            "documents": [document, copy.deepcopy(document)]}).status_code, 422)
        run = self.client.post("/document-runs", json={"question": "Explain astronomy"}).json()
        self.assertEqual(run["outcome"], "failed")
        self.assertEqual(self.client.post(f"/document-runs/{run['runId']}/diagnose").json()[
            "predictedFailureStep"], 1)

    def test_wrong_correction_still_fails_and_validator_is_protected(self):
        run = self.client.post("/document-runs", json={"failureType": "unsupported_answer"}).json()
        url = f"/document-runs/{run['runId']}/replay"
        response = self.client.post(url, json={"checkpointStep": 3, "alternativeAction": {
            "type": "replace_output", "output": {"answer": "Returns are accepted forever.", "citation": "current"}}})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["replayOutcome"], "failed")
        self.assertEqual(self.client.post(url, json={"checkpointStep": 4, "alternativeAction": {
            "type": "replace_output", "output": {"passed": True}}}).status_code, 422)

    def test_persistence_and_arithmetic_isolation(self):
        run = self.client.post("/document-runs", json={}).json()
        self.assertEqual(self.client.get("/runs").json(), [])
        with TestClient(create_app(data_dir=self.directory,
                                  fixture_path=self.directory / "absent.json")) as restarted:
            self.assertEqual(restarted.get(f"/document-runs/{run['runId']}").json(), run)
        missing = self.client.get("/document-runs/missing")
        self.assertEqual(missing.status_code, 404)
