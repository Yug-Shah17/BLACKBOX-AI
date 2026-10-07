"""Boundary inputs, all fault families, replay controls, and storage safety."""

import copy
import json
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from backend.app.main import create_app
from backend.app.services.store import RunStore, StorageError
from ml.baselines import first_local_evidence

CASES = [(0, 0), (-12, 30), (-100, -50), (1_000_000, -1_000_000), (1_000_000, 1_000_000)]
FAULTS = {"tool_error": 1, "invalid_selection": 2, "calculation_error": 3, "answer_mismatch": 4}


def correction(checkpoint, a, b):
    return {1: {"documents": [{"documentId": "primary", "values": [a, b]}]},
            2: {"documentId": "primary"}, 3: {"result": a + b}, 4: {"answer": a + b}}[checkpoint]


def run_matrix(client):
    results = []
    for a, b in CASES:
        for fault, checkpoint in FAULTS.items():
            response = client.post("/runs", json={"a": a, "b": b, "failureType": fault})
            if response.status_code != 201:
                raise AssertionError(response.text)
            original = response.json()
            identifier = original["runId"]
            diagnosis = client.post("/diagnose", json={"runId": identifier})
            if diagnosis.status_code != 200:
                raise AssertionError(diagnosis.text)
            prediction = diagnosis.json()["predictedFailureStep"]
            body = {"checkpointStep": checkpoint,
                    "alternativeAction": {"type": "replace_output", "output": correction(checkpoint, a, b)}}
            corrected = client.post(f"/runs/{identifier}/replay", json=body)
            if corrected.status_code != 201:
                raise AssertionError(corrected.text)
            result = corrected.json()
            wrong = copy.deepcopy(body)
            output = wrong["alternativeAction"]["output"]
            if checkpoint == 1:
                output["documents"][0]["values"][0] += 1
            elif checkpoint == 2:
                output["documentId"] = "missing"
            else:
                output["result" if checkpoint == 3 else "answer"] += 1
            wrong_response = client.post(f"/runs/{identifier}/replay", json=wrong)
            if wrong_response.status_code != 201:
                raise AssertionError(wrong_response.text)
            unchanged = client.get(f"/runs/{identifier}").json() == original
            comparison = client.get("/compare", params={"original": identifier, "replay": result["replayRunId"]})
            if comparison.status_code != 200:
                raise AssertionError(comparison.text)
            results.append({"a": a, "b": b, "fault": fault, "expectedStep": checkpoint,
                            "predictedStep": prediction, "correctedOutcome": result["replayOutcome"],
                            "wrongCorrectionOutcome": wrong_response.json()["replayOutcome"],
                            "originalPreserved": unchanged, "reusedSteps": result["reusedSteps"],
                            "executedSteps": result["executedSteps"],
                            "firstDivergence": comparison.json()["divergenceStep"]})
    return results


class RobustnessTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        self.addCleanup(temporary.cleanup)
        self.directory = Path(temporary.name)
        self.app = create_app(data_dir=self.directory, fixture_path=self.directory / "absent.json")
        self.client = TestClient(self.app)
        self.addCleanup(self.client.close)

    def test_fault_and_boundary_matrix(self):
        results = run_matrix(self.client)
        self.assertEqual(len(results), 20)
        for result in results:
            with self.subTest(a=result["a"], b=result["b"], fault=result["fault"]):
                self.assertEqual(result["predictedStep"], result["expectedStep"])
                self.assertEqual(result["correctedOutcome"], "success")
                self.assertEqual(result["wrongCorrectionOutcome"], "failed")
                self.assertTrue(result["originalPreserved"])
                self.assertEqual(result["firstDivergence"], result["expectedStep"])
                self.assertEqual(result["reusedSteps"], list(range(1, result["expectedStep"])))
                self.assertEqual(result["executedSteps"], list(range(result["expectedStep"], 6)))

    def test_healthy_boundaries_and_rules(self):
        for a, b in CASES:
            run = self.client.post("/runs", json={"a": a, "b": b, "failureType": "normal"}).json()
            self.assertEqual(run["outcome"], "success")
            self.assertEqual(self.client.post("/diagnose", json={"runId": run["runId"]}).json()["suspects"], [])
            observed = self.client.get(f"/runs/{run['runId']}/observed").json()
            self.assertEqual(first_local_evidence(observed), [])

    def test_nonfinite_persisted_values_are_rejected_without_rewriting(self):
        run = self.client.post("/runs", json={}).json()
        path = self.directory / "state.json"
        saved = json.loads(path.read_text())
        for value in (float("inf"), float("-inf"), float("nan"), "inf"):
            with self.subTest(value=str(value)):
                state = copy.deepcopy(saved)
                state["runs"][run["runId"]]["public"]["durationMs"] = value
                path.write_text(json.dumps(state), encoding="utf-8")
                before = path.read_bytes()
                self.assertEqual(self.client.get("/ready").status_code, 503)
                self.assertEqual(self.client.get("/health").status_code, 200)
                self.assertEqual(path.read_bytes(), before)
        state = copy.deepcopy(saved)
        state["checkpoints"][run["steps"][0]["checkpointId"]]["overflow"] = float("inf")
        path.write_text(json.dumps(state).replace('"overflow": Infinity', '"overflow": 1e999'), encoding="utf-8")
        before = path.read_bytes()
        self.assertEqual(self.client.get("/ready").status_code, 503)
        self.assertEqual(path.read_bytes(), before)

    def test_checkpoint_identity_and_versions(self):
        run = self.client.post("/runs", json={"failureType": "calculation_error"}).json()
        url = f"/runs/{run['runId']}/replay"
        body = {"checkpointStep": 3, "checkpointId": "wrong",
                "alternativeAction": {"type": "replace_output", "output": {"result": 42}}}
        self.assertEqual(self.client.post(url, json=body).status_code, 400)
        body.pop("checkpointId")
        state = json.loads((self.directory / "state.json").read_text())
        checkpoint = run["steps"][2]["checkpointId"]
        state["checkpoints"][checkpoint]["workflowVersion"] = "future-version"
        (self.directory / "state.json").write_text(json.dumps(state), encoding="utf-8")
        self.assertEqual(self.client.post(url, json=body).status_code, 409)
        state["checkpoints"].pop(checkpoint)
        (self.directory / "state.json").write_text(json.dumps(state), encoding="utf-8")
        self.assertEqual(self.client.post(url, json=body).status_code, 409)

    def test_replay_rejects_corrupt_prefix_checkpoint(self):
        run = self.client.post("/runs", json={"failureType": "calculation_error"}).json()
        url = f"/runs/{run['runId']}/replay"
        body = {"checkpointStep": 3,
                "alternativeAction": {"type": "replace_output", "output": {"result": 42}}}
        state = json.loads((self.directory / "state.json").read_text())
        prefix_checkpoint = run["steps"][0]["checkpointId"]
        state["checkpoints"][prefix_checkpoint]["runId"] = "other-run"
        (self.directory / "state.json").write_text(json.dumps(state), encoding="utf-8")
        self.assertEqual(self.client.post(url, json=body).status_code, 409)

        state["checkpoints"][prefix_checkpoint]["runId"] = run["runId"]
        state["checkpoints"][prefix_checkpoint]["workflowVersion"] = "future-version"
        (self.directory / "state.json").write_text(json.dumps(state), encoding="utf-8")
        self.assertEqual(self.client.post(url, json=body).status_code, 409)

    def test_replay_rejects_inconsistent_checkpoint_without_saving(self):
        run = self.client.post("/runs", json={"failureType": "calculation_error"}).json()
        path = self.directory / "state.json"
        original_state = json.loads(path.read_text())
        body = {"checkpointStep": 3,
                "alternativeAction": {"type": "replace_output", "output": {"result": 42}}}
        cases = [(2, "stepIndex", 1), (2, "prefix", []),
                 (2, "state", {}), (0, "stepIndex", 2),
                 (0, "config", {"a": 0, "b": 0, "failureType": "normal"})]
        for index, field, value in cases:
            with self.subTest(index=index, field=field):
                state = copy.deepcopy(original_state)
                state["checkpoints"][run["steps"][index]["checkpointId"]][field] = value
                path.write_text(json.dumps(state), encoding="utf-8")
                before = path.read_bytes()
                response = self.client.post(f"/runs/{run['runId']}/replay", json=body)
                self.assertEqual(response.status_code, 409)
                self.assertEqual(path.read_bytes(), before)

    def test_replay_branch_can_be_replayed_again(self):
        run = self.client.post("/runs", json={"failureType": "calculation_error"}).json()
        body = {"checkpointStep": 3,
                "alternativeAction": {"type": "replace_output", "output": {"result": 42}}}
        first = self.client.post(f"/runs/{run['runId']}/replay", json=body).json()
        saved = self.client.get(f"/runs/{first['replayRunId']}").json()
        response = self.client.post(f"/runs/{first['replayRunId']}/replay", json=body)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["replayOutcome"], "success")
        self.assertEqual(response.json()["reusedSteps"], [1, 2])
        self.assertEqual(self.client.get(f"/runs/{first['replayRunId']}").json(), saved)

    def test_model_uses_saved_trace_not_client_annotations(self):
        run = self.client.post("/runs", json={"failureType": "calculation_error"}).json()
        run["predictedFailureStep"] = 1
        run["steps"][2]["outputData"] = {"result": 42}
        result = self.client.post("/diagnose", json=run)
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()["predictedFailureStep"], 3)

    def test_threaded_saves_and_failed_atomic_replace(self):
        store = RunStore(self.directory / "threaded")
        def save(index):
            store.save({"public": {"runId": f"thread-{index}", "task": "Persistence test",
                                   "agentName": "test-agent", "outcome": "success", "durationMs": 0,
                                   "timestamp": "2026-10-06T00:00:00+00:00"}, "observed": None}, {})
        with ThreadPoolExecutor(max_workers=4) as executor:
            list(executor.map(save, range(20)))
        self.assertEqual(len(store.list_runs()), 20)
        before = store.path.read_bytes()
        with patch("backend.app.services.store.os.replace", side_effect=OSError("disk error")):
            with self.assertRaises(StorageError):
                save(21)
        self.assertEqual(store.path.read_bytes(), before)
        self.assertEqual(list(store.directory.glob("state-*.tmp")), [])

    def test_malformed_store_records_return_service_error(self):
        run = self.client.post("/runs", json={"failureType": "normal"}).json()
        path = self.directory / "state.json"
        good = json.loads(path.read_text())
        cases = [None, {}, {"public": None}, {"public": {"runId": "wrong"}},
                 {"public": {"runId": run["runId"]}}]
        for record in cases:
            with self.subTest(record=record):
                state = copy.deepcopy(good)
                state["runs"][run["runId"]] = record
                path.write_text(json.dumps(state), encoding="utf-8")
                response = self.client.get("/runs")
                self.assertEqual(response.status_code, 503)
                self.assertEqual(self.client.get("/health").status_code, 200)
                self.assertEqual(path.read_text(), json.dumps(state))

    def test_liveness_and_readiness_are_distinct(self):
        self.assertEqual(self.client.get("/health").status_code, 200)
        self.assertEqual(self.client.get("/ready").json()["status"], "ready")
        unavailable = create_app(data_dir=self.directory, model_path=self.directory / "missing.joblib",
                                 fixture_path=self.directory / "absent.json")
        with TestClient(unavailable) as client:
            self.assertEqual(client.get("/health").status_code, 200)
            self.assertEqual(client.get("/ready").status_code, 503)

    def test_readiness_detects_metrics_version_mismatch(self):
        from backend.app.main import ROOT
        measured = json.loads((ROOT / "ml" / "outputs" / "metrics.json").read_text())
        measured["modelVersion"] = "wrong-model"
        path = self.directory / "metrics.json"
        path.write_text(json.dumps(measured), encoding="utf-8")
        self.app.state.metrics_path = path
        self.assertEqual(self.client.get("/ready").status_code, 503)
        path.unlink()
        self.assertEqual(self.client.get("/ready").status_code, 503)

    def test_readiness_detects_dataset_fingerprint_mismatch(self):
        from backend.app.main import ROOT
        measured = json.loads((ROOT / "ml" / "outputs" / "metrics.json").read_text())
        measured["datasetSha256"] = "not-the-training-dataset"
        path = self.directory / "metrics.json"
        path.write_text(json.dumps(measured), encoding="utf-8")
        self.app.state.metrics_path = path
        self.assertEqual(self.client.get("/ready").status_code, 503)


if __name__ == "__main__":
    unittest.main()
