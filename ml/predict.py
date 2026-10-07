"""Backend-facing diagnosis adapter for the controlled demo baseline."""

import argparse
import json
from pathlib import Path

import joblib
import sklearn

if __package__:
    from .features import extract_features, step_features
    from .trace_schema import SCHEMA_VERSION, validate_run
else:
    from features import extract_features, step_features
    from trace_schema import SCHEMA_VERSION, validate_run

DEFAULT_MODEL = Path(__file__).resolve().parent / "models" / "step_ranker.joblib"


class Diagnoser:
    """Instantiate once in the backend; load only a trusted local artifact."""

    def __init__(self, model_path=DEFAULT_MODEL):
        self.artifact = joblib.load(model_path)
        if self.artifact["schemaVersion"] != SCHEMA_VERSION:
            raise ValueError("Model schemaVersion mismatch")
        if self.artifact.get("sklearnVersion") != sklearn.__version__:
            raise ValueError("Model sklearnVersion mismatch; retrain with the installed dependencies")

    def diagnose(self, run, top_k=3):
        if type(top_k) is not int or top_k <= 0:
            raise ValueError("top_k must be a positive integer")
        validate_run(run)
        if run.get("source") != "synthetic-controlled-workflow":
            return {"runId": run["runId"], "modelVersion": self.artifact["modelVersion"],
                    "mode": "model", "status": "unsupported_trace", "suspects": [],
                    "explanation": "This model supports only the controlled arithmetic demo."}
        features = extract_features(run)
        model = self.artifact["model"]
        positive = list(model.classes_).index(1)
        scores = model.predict_proba(features)[:, positive]
        order = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)
        suspects = []
        for index in order[:top_k]:
            step = run["steps"][index]
            evidence = step_features(step)[1]
            suspects.append({"stepId": step["stepId"], "score": round(float(scores[index]), 6),
                             "evidence": [{"stepId": step["stepId"], **item} for item in evidence]})
        status = "suspected_failure" if max(scores) >= 0.5 else "insufficient_evidence"
        return {"runId": run["runId"], "modelVersion": self.artifact["modelVersion"],
                "mode": "model", "status": status,
                "suspects": suspects if status == "suspected_failure" else [],
                "explanation": "Learned ranking of observable demo inconsistencies and errors; scores are not calibrated confidence."}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--runs", type=Path, default=DEFAULT_MODEL.parents[2] / "data" / "agent_ml" / "agent_runs.jsonl")
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--model", type=Path, default=DEFAULT_MODEL)
    args = parser.parse_args()
    with args.runs.open(encoding="utf-8") as stream:
        run = next((row for line in stream if (row := json.loads(line))["runId"] == args.run_id), None)
    if run is None:
        parser.error("Unknown run ID")
    print(json.dumps(Diagnoser(args.model).diagnose(run), indent=2))


if __name__ == "__main__":
    main()
