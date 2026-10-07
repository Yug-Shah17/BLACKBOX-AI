"""Train a baseline and evaluate by scenario, including an unseen fault type."""

import argparse
import hashlib
import json
from pathlib import Path

import joblib
import sklearn
from sklearn.feature_extraction import DictVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import Pipeline

if __package__:
    from .features import extract_features
    from .trace_schema import SCHEMA_VERSION, validate_labels
else:
    from features import extract_features
    from trace_schema import SCHEMA_VERSION, validate_labels

ROOT = Path(__file__).resolve().parents[1]
MODEL_VERSION = "demo-step-ranker-v1"
HELD_OUT = "answer_mismatch"


def load_jsonl(path):
    with path.open(encoding="utf-8") as stream:
        return [json.loads(line) for line in stream if line.strip()]


def scores(model, run):
    probabilities = model.predict_proba(extract_features(run))
    positive = list(model.classes_).index(1)
    return probabilities[:, positive].tolist()


def evaluate(model, pairs):
    failures = correct = top3 = normal = false_positive = heuristic = 0
    for run, label in pairs:
        values = scores(model, run)
        order = sorted(range(len(values)), key=lambda i: values[i], reverse=True)
        root = label["rootCauseStepId"]
        if root is None:
            normal += 1
            false_positive += max(values) >= 0.5
        else:
            failures += 1
            ranked = [run["steps"][i]["stepId"] for i in order]
            correct += ranked[0] == root
            top3 += root in ranked[:3]
            errors = [step["stepId"] for step in run["steps"] if step["status"] == "error"]
            heuristic += bool(errors) and errors[-1] == root
    return {"runCount": len(pairs), "failedRunCount": failures, "successfulRunCount": normal,
            "top1Localization": correct / failures if failures else None,
            "top3Localization": top3 / failures if failures else None,
            "successfulRunFalsePositiveRate": false_positive / normal if normal else None,
            "lastErrorTop1Baseline": heuristic / failures if failures else None}


def train(data_dir, model_path, metrics_path, seed=42):
    runs = load_jsonl(data_dir / "agent_runs.jsonl")
    labels = load_jsonl(data_dir / "evaluation_labels.jsonl")
    validate_labels(runs, labels)
    by_id = {label["runId"]: label for label in labels}
    pairs = [(run, by_id[run["runId"]]) for run in runs]
    groups = [label["scenarioId"] for _, label in pairs]
    if len(set(groups)) < 10:
        raise ValueError("At least 10 distinct scenarios are required")
    splitter = GroupShuffleSplit(n_splits=1, test_size=0.25, random_state=seed)
    training_indices, test_indices = next(splitter.split(pairs, groups=groups))
    training = [pairs[i] for i in training_indices if pairs[i][1]["failureType"] != HELD_OUT]
    testing = [pairs[i] for i in test_indices]
    features, targets = [], []
    for run, label in training:
        features.extend(extract_features(run))
        targets.extend(int(step["stepId"] == label["rootCauseStepId"]) for step in run["steps"])
    if set(targets) != {0, 1}:
        raise ValueError("Training requires normal and root-cause steps")
    model = Pipeline([("vectorizer", DictVectorizer()),
                      ("classifier", LogisticRegression(class_weight="balanced", random_state=seed, max_iter=1000))])
    model.fit(features, targets)
    train_groups = sorted({label["scenarioId"] for _, label in training})
    test_groups = sorted({label["scenarioId"] for _, label in testing})
    assert not set(train_groups) & set(test_groups)
    fingerprint = hashlib.sha256((data_dir / "agent_runs.jsonl").read_bytes() +
                                 (data_dir / "evaluation_labels.jsonl").read_bytes()).hexdigest()
    model_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": model, "schemaVersion": SCHEMA_VERSION,
                 "modelVersion": MODEL_VERSION, "sklearnVersion": sklearn.__version__,
                 "datasetSha256": fingerprint, "trainingSeed": seed,
                 "trainingRunCount": len(training), "heldOutFailureType": HELD_OUT,
                 "featureNames": sorted(features[0]),
                 "scope": "synthetic arithmetic workflow only"}, model_path)
    metrics = {"modelVersion": MODEL_VERSION, "schemaVersion": SCHEMA_VERSION,
               "datasetSha256": fingerprint, "seed": seed, "dataSource": "synthetic-controlled-workflow",
               "splitMethod": "scenario-grouped 75/25; answer_mismatch excluded from training",
               "trainScenarioIds": train_groups, "testScenarioIds": test_groups,
               "trainingRunCount": len(training), "heldOutFailureType": HELD_OUT,
               "seenFailures": evaluate(model, [p for p in testing if p[1]["failureType"] != HELD_OUT]),
               "unseenFailure": evaluate(model, [p for p in testing if p[1]["failureType"] == HELD_OUT]),
               "limitations": "Demo-specific evidence features; scores are not calibrated confidence. No real-trace evaluation. Rule comparisons and fixture-corrected replay are reported separately."}
    metrics_path.parent.mkdir(parents=True, exist_ok=True)
    metrics_path.write_text(json.dumps(metrics, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps({key: metrics[key] for key in ("trainingRunCount", "seenFailures", "unseenFailure")}, indent=2))
    print(f"Model: {model_path}\nMetrics: {metrics_path}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=ROOT / "data" / "agent_ml")
    parser.add_argument("--model-output", type=Path, default=ROOT / "ml" / "models" / "step_ranker.joblib")
    parser.add_argument("--metrics-output", type=Path, default=ROOT / "ml" / "outputs" / "metrics.json")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    train(args.data_dir, args.model_output, args.metrics_output, args.seed)


if __name__ == "__main__":
    main()
