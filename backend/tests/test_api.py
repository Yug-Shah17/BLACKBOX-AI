import copy
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from backend.app.main import ROOT, create_app
from backend.app.services import workflow


class BackendTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name)
        self.app = create_app(data_dir=self.directory, fixture_path=self.directory / "no-fixtures.json")
        self.client = TestClient(self.app)
        self.addCleanup(self.client.close)

    def create(self, failure="calculation_error"):
        response = self.client.post("/runs", json={"a": 12, "b": 30, "failureType": failure})
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def replay(self, run, value=42, checkpoint=3):
        key = "answer" if checkpoint == 4 else "result"
        return self.client.post(f"/runs/{run['runId']}/replay", json={
            "checkpointStep": checkpoint,
            "alternativeAction": {"type": "replace_output", "output": {key: value}}})

    def test_end_to_end_diagnosis_replay_compare(self):
        original = self.create()
        diagnosis = self.client.post("/diagnose", json={"runId": original["runId"]})
        self.assertEqual(diagnosis.status_code, 200, diagnosis.text)
        self.assertEqual(diagnosis.json()["predictedFailureStep"], 3)
        self.assertIsNone(diagnosis.json()["confidence"])
        self.assertTrue(diagnosis.json()["evidence"])
        # Count real tool executions, not just replay's reported step numbers.
        with patch.object(workflow, "execute_step", wraps=workflow.execute_step) as executor:
            response = self.replay(original)
            self.assertEqual(executor.call_count, 3)
            self.assertEqual([call.args[0] for call in executor.call_args_list], [2, 3, 4])
        self.assertEqual(response.status_code, 201, response.text)
        branch = response.json()
        self.assertEqual(branch["replayOutcome"], "success")
        self.assertEqual(branch["reusedSteps"], [1, 2])
        self.assertEqual(branch["executedSteps"], [3, 4, 5])
        self.assertEqual(self.client.get(f"/runs/{original['runId']}").json(), original)
        replay = self.client.get(f"/runs/{branch['replayRunId']}").json()
        self.assertEqual(replay["parentRunId"], original["runId"])
        self.assertEqual(replay["steps"][-1]["outputData"], {"passed": True})
        comparison = self.client.get("/compare", params={"original": original["runId"], "replay": replay["runId"]})
        self.assertEqual(comparison.status_code, 200, comparison.text)
        self.assertEqual(comparison.json()["divergenceStep"], 3)
        self.assertEqual([s["changed"] for s in comparison.json()["steps"]], [False, False, True, True, True])

    def test_wrong_fix_remains_failed_and_replays_are_unique(self):
        original = self.create()
        first, second = self.replay(original, 99), self.replay(original, 99)
        self.assertEqual(first.status_code, 201)
        self.assertEqual(first.json()["replayOutcome"], "failed")
        self.assertNotEqual(first.json()["replayRunId"], second.json()["replayRunId"])

    def test_healthy_run_and_unchanged_replay(self):
        normal = self.create("normal")
        response = self.client.post("/diagnose", json=normal)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["suspects"], [])
        self.assertIsNone(response.json()["predictedFailureStep"])
        replay = self.replay(normal).json()
        comparison = self.client.get("/compare", params={"original": normal["runId"], "replay": replay["replayRunId"]}).json()
        self.assertIsNone(comparison["divergenceStep"])
        self.assertEqual(replay["changedSteps"], [])

    def test_all_supported_fault_corrections(self):
        scenarios = [("tool_error", 1, {"documents": [{"documentId": "primary", "values": [12, 30]}]}),
                     ("invalid_selection", 2, {"documentId": "primary"}),
                     ("answer_mismatch", 4, {"answer": 42})]
        for fault, checkpoint, output in scenarios:
            with self.subTest(fault=fault):
                run = self.create(fault)
                response = self.client.post(f"/runs/{run['runId']}/replay", json={
                    "checkpointStep": checkpoint, "alternativeAction": {"type": "replace_output", "output": output}})
                self.assertEqual(response.status_code, 201, response.text)
                self.assertEqual(response.json()["replayOutcome"], "success")

    def test_restart_and_replay_of_replay(self):
        original = self.create()
        replay_id = self.replay(original).json()["replayRunId"]
        with TestClient(create_app(data_dir=self.directory, fixture_path=self.directory / "no-fixtures.json")) as restarted:
            branch = restarted.get(f"/runs/{replay_id}").json()
            response = restarted.post(f"/runs/{replay_id}/replay", json={
                "checkpointStep": 2,
                "alternativeAction": {"type": "replace_output", "output": {"documentId": "primary"}}})
            self.assertEqual(response.status_code, 201, response.text)
            # Calculation fault remains configured after replaying an earlier step.
            self.assertEqual(response.json()["replayOutcome"], "failed")
            self.assertEqual(branch["outcome"], "success")

    def test_invalid_requests_and_missing_ids(self):
        run = self.create()
        for checkpoint in [-1, 0, 5, 100, "3"]:
            self.assertEqual(self.replay(run, checkpoint=checkpoint).status_code, 422)
        response = self.client.post(f"/runs/{run['runId']}/replay", json={
            "checkpointStep": 3, "alternativeAction": {"type": "replace_output", "output": {"result": "bad"}}})
        self.assertEqual(response.status_code, 422)
        self.assertEqual(self.client.get("/runs/missing").status_code, 404)
        self.assertEqual(self.client.post("/diagnose", json={"runId": "missing"}).status_code, 404)
        self.assertEqual(self.client.post("/runs", json={"a": True}).status_code, 422)
        other = self.create()
        self.assertEqual(self.client.get("/compare", params={"original": run["runId"], "replay": other["runId"]}).status_code, 400)

    def test_labels_and_checkpoint_settings_not_in_observed_trace(self):
        run = self.create()
        observed = self.client.get(f"/runs/{run['runId']}/observed").json()
        encoded = json.dumps(observed)
        for forbidden in ["failureType", "rootCauseStepId", "scenarioId", "calculation_error"]:
            self.assertNotIn(forbidden, encoded)
        snapshot = copy.deepcopy(observed)
        self.client.post("/diagnose", json=run)
        self.assertEqual(self.client.get(f"/runs/{run['runId']}/observed").json(), snapshot)

    def test_real_metrics_and_unmeasured_fields(self):
        response = self.client.get("/metrics")
        self.assertEqual(response.status_code, 200, response.text)
        measured = json.loads((ROOT / "ml" / "outputs" / "metrics.json").read_text(encoding="utf-8"))
        self.assertEqual(response.json()["top1Accuracy"], measured["seenFailures"]["top1Localization"])
        self.assertIsNone(response.json()["stepPrecision"])
        self.assertEqual(response.json()["dataSource"], "synthetic-controlled-workflow")

    def test_unavailable_model_and_corrupt_storage(self):
        run = self.create()
        self.app.state.diagnoser.model_path = self.directory / "missing.joblib"
        self.assertEqual(self.client.post("/diagnose", json={"runId": run["runId"]}).status_code, 503)
        (self.directory / "state.json").write_text("{broken", encoding="utf-8")
        self.assertEqual(self.client.get("/runs").status_code, 503)

    def test_missing_and_corrupt_metrics(self):
        path = self.directory / "metrics.json"
        self.app.state.metrics_path = path
        self.assertEqual(self.client.get("/metrics").status_code, 404)
        path.write_text("{broken", encoding="utf-8")
        self.assertEqual(self.client.get("/metrics").status_code, 503)

    def test_legacy_fixture_is_not_fake_diagnosis_or_replay(self):
        fixture = self.directory / "fixtures.json"
        fixture.write_text(json.dumps([{"runId": "legacy", "task": "Find flights", "agentName": "travel",
                                       "outcome": "failed", "durationMs": 1, "timestamp": "2026-10-03T00:00:00Z", "steps": []}]), encoding="utf-8")
        with TestClient(create_app(data_dir=self.directory / "legacy", fixture_path=fixture)) as client:
            response = client.post("/diagnose", json={"runId": "legacy"})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["status"], "unsupported_trace")
            self.assertIsNone(response.json()["predictedFailureStep"])
            response = client.post("/runs/legacy/replay", json={"checkpointStep": 3,
                                  "alternativeAction": {"type": "replace_output", "output": {"result": 42}}})
            self.assertEqual(response.status_code, 409)


if __name__ == "__main__":
    unittest.main()
