"""Evaluate a saved model against rules on fresh controlled synthetic traces."""

import argparse
import hashlib
import json
import platform
from pathlib import Path

import sklearn

from ml.baselines import first_local_evidence, last_error
from ml.generate_dataset import generate_dataset
from ml.predict import DEFAULT_MODEL, Diagnoser

ROOT = Path(__file__).resolve().parents[1]


def metrics(pairs, ranker):
    failures = healthy = correct = top3 = detected = false_alarm = 0
    reciprocal_rank = 0.0
    for run, label in pairs:
        ranking = ranker(run)
        root = label["rootCauseStepId"]
        if root is None:
            healthy += 1
            false_alarm += bool(ranking)
        else:
            failures += 1
            detected += bool(ranking)
            correct += bool(ranking) and ranking[0] == root
            top3 += root in ranking[:3]
            if root in ranking:
                reciprocal_rank += 1 / (ranking.index(root) + 1)
    precision = detected / (detected + false_alarm) if detected + false_alarm else None
    recall = detected / failures if failures else None
    f1 = (2 * precision * recall / (precision + recall)
          if precision is not None and recall is not None and precision + recall else None)
    return {"runCount": len(pairs), "failedRunCount": failures, "healthyRunCount": healthy,
            "top1Localization": correct / failures if failures else None,
            "top3Localization": top3 / failures if failures else None,
            "meanReciprocalRank": reciprocal_rank / failures if failures else None,
            "healthyFalsePositiveRate": false_alarm / healthy if healthy else None,
            "failureDetectionPrecision": precision, "failureDetectionRecall": recall,
            "failureDetectionF1": f1}


def benchmark(model_path=DEFAULT_MODEL, seeds=(101, 202, 303), scenarios=100):
    predictor = Diagnoser(model_path)
    pairs = []
    fingerprints = []
    for seed in seeds:
        runs, labels = generate_dataset(scenarios, seed)
        pairs.extend(zip(runs, labels))
        encoded = json.dumps([runs, labels], sort_keys=True, allow_nan=False).encode()
        fingerprints.append({"seed": seed, "sha256": hashlib.sha256(encoded).hexdigest()})

    def learned(run):
        return [suspect["stepId"] for suspect in predictor.diagnose(run, top_k=len(run["steps"]))["suspects"]]

    rankers = {"learned": learned, "lastError": last_error, "firstLocalEvidence": first_local_evidence}
    results = {name: metrics(pairs, ranker) for name, ranker in rankers.items()}
    faults = sorted({label["failureType"] for _, label in pairs})
    per_fault = {fault: {name: metrics([p for p in pairs if p[1]["failureType"] == fault], ranker)
                        for name, ranker in rankers.items()} for fault in faults}
    return {"modelVersion": predictor.artifact["modelVersion"],
            "modelSha256": hashlib.sha256(Path(model_path).read_bytes()).hexdigest(),
            "pythonVersion": platform.python_version(), "sklearnVersion": sklearn.__version__,
            "dataSource": "fresh synthetic arithmetic traces; not real-world agent logs",
            "seeds": list(seeds), "scenariosPerSeed": scenarios,
            "datasetFingerprints": fingerprints, "results": results, "perFailureType": per_fault,
            "interpretation": "The rules use the same observable local checks as the model. "
                              "Matching the rules does not demonstrate an ML advantage. "
                              "Fresh seeds test reproducibility within one generator, not workflow generalization.",
            "limitations": ["Fixed five-step workflow and single injected fault per failed run",
                            "Hand-engineered arithmetic consistency features",
                            "Uncalibrated scores; fixed 0.5 abstention threshold",
                            "No arbitrary-agent, real-world, or simultaneous-fault validation"]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", type=Path, default=DEFAULT_MODEL)
    parser.add_argument("--output", type=Path, default=ROOT / "ml" / "outputs" / "benchmark.json")
    parser.add_argument("--scenarios", type=int, default=100)
    args = parser.parse_args()
    if args.scenarios < 10:
        parser.error("Use at least 10 scenarios")
    result = benchmark(args.model, scenarios=args.scenarios)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps(result["results"], indent=2))
    print(f"Report: {args.output}")


if __name__ == "__main__":
    main()
