"""Checks for reproducibility, label isolation, and grouped evaluation."""

import copy
import json
import tempfile
import unittest
from pathlib import Path

from ml.generate_dataset import generate_dataset, write_jsonl
from ml.features import extract_features
from ml.predict import Diagnoser
from ml.trace_schema import validate_run
from ml.train_model import train


class PipelineTests(unittest.TestCase):
    def test_reproducible_and_label_isolation(self):
        runs, labels = generate_dataset(10, 42)
        self.assertEqual((runs, labels), generate_dataset(10, 42))
        self.assertNotEqual(runs, generate_dataset(10, 43)[0])
        run = copy.deepcopy(runs[0])
        run["rootCauseStepId"] = "injected-answer"
        with self.assertRaises(ValueError):
            extract_features(run)

    def test_invalid_trace_rejected(self):
        run = generate_dataset(10)[0][0]
        for mutation in ("duration", "duplicate", "dependency"):
            changed = copy.deepcopy(run)
            if mutation == "duration":
                changed["steps"][0]["durationMs"] = float("nan")
            elif mutation == "duplicate":
                changed["steps"][1]["stepId"] = changed["steps"][0]["stepId"]
            else:
                changed["steps"][0]["parentStepIds"] = ["unknown"]
            with self.assertRaises(ValueError):
                validate_run(changed)

    def test_training_and_prediction(self):
        runs, labels = generate_dataset(30)
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            write_jsonl(folder / "agent_runs.jsonl", runs)
            write_jsonl(folder / "evaluation_labels.jsonl", labels)
            train(folder, folder / "model.joblib", folder / "metrics.json")
            metrics = json.loads((folder / "metrics.json").read_text())
            self.assertFalse(set(metrics["trainScenarioIds"]) & set(metrics["testScenarioIds"]))
            self.assertGreater(metrics["seenFailures"]["top1Localization"], metrics["seenFailures"]["lastErrorTop1Baseline"])
            diagnoser = Diagnoser(folder / "model.joblib")
            self.assertEqual(diagnoser.artifact["datasetSha256"], metrics["datasetSha256"])
            self.assertEqual(diagnoser.artifact["trainingRunCount"], metrics["trainingRunCount"])
            self.assertEqual(diagnoser.artifact["heldOutFailureType"], "answer_mismatch")
            for run, label in zip(runs, labels):
                if label["failureType"] == "calculation_error":
                    diagnosis = diagnoser.diagnose(run)
                    self.assertEqual(diagnosis["suspects"][0]["stepId"], label["rootCauseStepId"])
                    self.assertTrue(diagnosis["suspects"][0]["evidence"])
                    break
            external = copy.deepcopy(runs[0])
            external["source"] = "backend"
            self.assertEqual(diagnoser.diagnose(external)["status"], "unsupported_trace")


if __name__ == "__main__":
    unittest.main()
