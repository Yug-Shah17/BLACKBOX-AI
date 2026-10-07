"""Metric arithmetic, label isolation, rules, and observable feature boundaries."""

import copy
import tempfile
import unittest
from pathlib import Path

import joblib

from ml.baselines import first_local_evidence, last_error
from ml.evaluate_model import metrics
from ml.features import extract_features
from ml.generate_dataset import generate_dataset
from ml.predict import DEFAULT_MODEL, Diagnoser
from ml.trace_schema import validate_labels, validate_run


class EvaluationTests(unittest.TestCase):
    def test_metric_denominators_and_abstention(self):
        pairs = [({"id": "a"}, {"rootCauseStepId": "root"}),
                 ({"id": "b"}, {"rootCauseStepId": "root"}),
                 ({"id": "c"}, {"rootCauseStepId": None})]
        rankings = {"a": ["root"], "b": ["other", "root"], "c": ["other"]}
        report = metrics(pairs, lambda run: rankings[run["id"]])
        self.assertEqual(report["top1Localization"], 0.5)
        self.assertEqual(report["top3Localization"], 1)
        self.assertEqual(report["meanReciprocalRank"], 0.75)
        self.assertEqual(report["healthyFalsePositiveRate"], 1)
        self.assertAlmostEqual(report["failureDetectionPrecision"], 2 / 3)
        self.assertEqual(report["failureDetectionRecall"], 1)
        empty = metrics([], lambda run: [])
        self.assertIsNone(empty["top1Localization"])
        self.assertIsNone(empty["failureDetectionF1"])

    def test_rules_expose_generator_simplicity(self):
        runs, labels = generate_dataset(10, 101)
        report = metrics(list(zip(runs, labels)), first_local_evidence)
        self.assertEqual(report["top1Localization"], 1)
        self.assertEqual(report["healthyFalsePositiveRate"], 0)
        self.assertEqual(metrics(list(zip(runs, labels)), last_error)["top1Localization"], 0)

    def test_ids_and_timings_are_not_model_features(self):
        run = generate_dataset(10)[0][0]
        changed = copy.deepcopy(run)
        changed["runId"] = "unrelated-id"
        mapping = {s["stepId"]: f"opaque-{i}" for i, s in enumerate(changed["steps"])}
        for step in changed["steps"]:
            step["stepId"] = mapping[step["stepId"]]
            step["parentStepIds"] = [mapping[p] for p in step["parentStepIds"]]
            step["durationMs"] = 98765
        self.assertEqual(extract_features(run), extract_features(changed))

    def test_nested_labels_and_malformed_arithmetic_rejected(self):
        source = generate_dataset(10)[0][0]
        for mutation in ("nested_label", "nan", "values", "timestamp", "parent", "order", "boolean"):
            run = copy.deepcopy(source)
            if mutation == "nested_label":
                run["steps"][0]["output"]["rootCauseStepId"] = "secret"
            elif mutation == "nan":
                run["finalOutput"]["answer"] = float("nan")
            elif mutation == "values":
                run["steps"][2]["input"]["values"] = ["bad"]
            elif mutation == "timestamp":
                run["steps"][0]["startedAt"] = 42
            elif mutation == "parent":
                run["steps"][0]["parentStepIds"] = [{}]
            elif mutation == "order":
                run["steps"][1]["stepType"] = "generation"
            else:
                run["steps"][2]["output"]["result"] = True
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                validate_run(run)

    def test_bad_labels_are_rejected_before_training(self):
        runs, labels = generate_dataset(10)
        labels[0]["scenarioId"] = ""
        with self.assertRaises(ValueError):
            validate_labels(runs, labels)

    def test_artifact_version_guard_and_invalid_top_k(self):
        artifact = joblib.load(DEFAULT_MODEL)
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "model.joblib"
            for field in ("schemaVersion", "sklearnVersion"):
                changed = {**artifact, field: "incompatible-version"}
                joblib.dump(changed, path)
                with self.subTest(field=field), self.assertRaises(ValueError):
                    Diagnoser(path)
        run = generate_dataset(10)[0][0]
        for top_k in (0, -1, True, "3"):
            with self.subTest(top_k=top_k), self.assertRaises(ValueError):
                Diagnoser().diagnose(run, top_k=top_k)

    def test_unsupported_source_does_not_run_arithmetic_features(self):
        run = generate_dataset(10)[0][0]
        run["source"] = "external-agent"
        run["steps"][2]["input"]["values"] = ["external", "format"]
        self.assertEqual(Diagnoser().diagnose(run)["status"], "unsupported_trace")


if __name__ == "__main__":
    unittest.main()
