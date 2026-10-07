"""Execute a deterministic synthetic agent workflow with controlled faults."""

import argparse
import json
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

if __package__:
    from .trace_schema import SCHEMA_VERSION, validate_labels, validate_run
else:
    from trace_schema import SCHEMA_VERSION, validate_labels, validate_run

ROOT = Path(__file__).resolve().parents[1]
FAILURES = ("tool_error", "invalid_selection", "calculation_error", "answer_mismatch")


def execute(scenario, a, b, failure, rng):
    run_id = f"{scenario}-{failure}"
    steps = []
    root = None

    def record(kind, inputs, outputs, error=None):
        step_id = f"{run_id}-step-{len(steps)}"
        stamp = datetime(2026, 1, 1, tzinfo=timezone.utc) + timedelta(seconds=len(steps))
        steps.append({"stepId": step_id, "stepIndex": len(steps),
                      "parentStepIds": [steps[-1]["stepId"]] if steps else [],
                      "stepType": kind, "name": kind, "input": inputs, "output": outputs,
                      "status": "error" if error else "success", "error": error,
                      "startedAt": stamp.isoformat(), "durationMs": rng.randint(10, 90),
                      "checkpointId": None})
        return step_id

    documents = [{"documentId": "primary", "values": [a, b]}]
    if failure == "tool_error":
        documents = []
    identifier = record("retrieval", {"query": "Fetch the primary document"},
                        {"documents": documents},
                        {"code": "TOOL_UNAVAILABLE"} if not documents else None)
    if failure == "tool_error":
        root = identifier
    selected_id = "missing" if failure == "invalid_selection" else "primary"
    identifier = record("selection", {"documents": documents}, {"documentId": selected_id})
    if failure == "invalid_selection":
        root = identifier
    selected = next((d for d in documents if d["documentId"] == selected_id), None)
    values = selected["values"] if selected else []
    result = sum(values) if values else None
    if failure == "calculation_error":
        result += rng.choice([-7, -3, 4, 9])
    identifier = record("calculation", {"values": values, "operation": "sum"},
                        {"result": result}, {"code": "NO_INPUT"} if result is None else None)
    if failure == "calculation_error":
        root = identifier
    answer = result
    if failure == "answer_mismatch":
        answer += rng.choice([-5, 6, 11])
    identifier = record("generation", {"result": result}, {"answer": answer})
    if failure == "answer_mismatch":
        root = identifier
    passed = answer == a + b
    record("validation", {"answer": answer, "expected": a + b}, {"passed": passed},
           {"code": "TASK_FAILED"} if not passed else None)
    run = {"runId": run_id, "schemaVersion": SCHEMA_VERSION,
           "source": "synthetic-controlled-workflow", "task": "Sum the primary document values",
           "status": "success" if passed else "failed", "steps": steps,
           "finalOutput": {"answer": answer}}
    label = {"runId": run_id, "scenarioId": scenario, "failureType": failure,
             "rootCauseStepId": root}
    validate_run(run)
    return run, label


def generate_dataset(scenarios=100, seed=42):
    rng = random.Random(seed)
    runs, labels = [], []
    for index in range(scenarios):
        scenario = f"scenario-{seed}-{index:05d}"
        a, b = rng.randint(-1000, 1000), rng.randint(-1000, 1000)
        for failure in ("normal", *FAILURES):
            run, label = execute(scenario, a, b, failure, rng)
            runs.append(run)
            labels.append(label)
    validate_labels(runs, labels)
    return runs, labels


def write_jsonl(path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as stream:
        for row in rows:
            stream.write(json.dumps(row, allow_nan=False) + "\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scenarios", type=int, default=100)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--output-dir", type=Path, default=ROOT / "data" / "agent_ml")
    args = parser.parse_args()
    if args.scenarios < 10:
        parser.error("--scenarios must be at least 10 for grouped evaluation")
    runs, labels = generate_dataset(args.scenarios, args.seed)
    write_jsonl(args.output_dir / "agent_runs.jsonl", runs)
    write_jsonl(args.output_dir / "evaluation_labels.jsonl", labels)
    print(f"Generated {len(runs)} runs across {args.scenarios} scenarios")
    print(f"Observed traces and separate labels: {args.output_dir}")
    print("Source: synthetic controlled workflow; no real-world accuracy claim")


if __name__ == "__main__":
    main()
