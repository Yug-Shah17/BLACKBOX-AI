"""Provisional observable agent-run contract, independent of evaluation labels."""

import math
from datetime import datetime

SCHEMA_VERSION = "black-box.agent-run.v1"
STEP_TYPES = {"retrieval", "selection", "calculation", "generation", "validation"}
RESERVED_LABELS = {"rootCauseStepId", "failureType", "scenarioId", "isRootCause"}


def _validate_json(value):
    if isinstance(value, dict):
        if RESERVED_LABELS & value.keys():
            raise ValueError("Evaluation labels must remain outside observed data")
        if any(not isinstance(key, str) for key in value):
            raise ValueError("JSON object keys must be strings")
        for item in value.values():
            _validate_json(item)
    elif isinstance(value, list):
        for item in value:
            _validate_json(item)
    elif type(value) is float and not math.isfinite(value):
        raise ValueError("Observed JSON numbers must be finite")
    elif value is not None and type(value) not in {str, int, float, bool}:
        raise ValueError("Observed data must contain JSON-compatible values")


def _validate_arithmetic_step(step):
    def number(value):
        return type(value) in {int, float} and math.isfinite(value)

    def documents(value):
        return (isinstance(value, list) and all(isinstance(item, dict)
                and isinstance(item.get("documentId"), str)
                and isinstance(item.get("values"), list)
                and all(number(n) for n in item["values"]) for item in value))

    kind, inputs, outputs = step["stepType"], step["input"], step["output"]
    if kind == "retrieval":
        valid = isinstance(inputs.get("query"), str) and documents(outputs.get("documents"))
    elif kind == "selection":
        valid = documents(inputs.get("documents")) and isinstance(outputs.get("documentId"), str)
    elif kind == "calculation":
        valid = (isinstance(inputs.get("values"), list) and all(number(n) for n in inputs["values"])
                 and inputs.get("operation") == "sum" and "result" in outputs
                 and (outputs["result"] is None or number(outputs["result"])))
    elif kind == "generation":
        valid = ("result" in inputs and "answer" in outputs
                 and (inputs["result"] is None or number(inputs["result"]))
                 and (outputs["answer"] is None or number(outputs["answer"])))
    else:
        valid = ("answer" in inputs and (inputs["answer"] is None or number(inputs["answer"]))
                 and number(inputs.get("expected")) and type(outputs.get("passed")) is bool)
    if not valid:
        raise ValueError(f"Invalid arithmetic {kind} input/output")


def validate_run(run):
    """Validate the bounded demo contract before generation or inference."""
    required = {"runId", "schemaVersion", "source", "task", "status", "steps", "finalOutput"}
    if not isinstance(run, dict) or not required <= run.keys():
        raise ValueError("Run is missing required fields")
    _validate_json(run)
    if RESERVED_LABELS & run.keys():
        raise ValueError("Evaluation labels must remain outside observed runs")
    if run["schemaVersion"] != SCHEMA_VERSION:
        raise ValueError("Unsupported schemaVersion")
    if not isinstance(run["runId"], str) or not run["runId"]:
        raise ValueError("runId must be a nonempty string")
    if not isinstance(run["source"], str) or not isinstance(run["task"], str):
        raise ValueError("source and task must be strings")
    if not isinstance(run["finalOutput"], dict):
        raise ValueError("finalOutput must be an object")
    if not isinstance(run["status"], str) or run["status"] not in {"success", "failed"}:
        raise ValueError("Invalid run status")
    if not isinstance(run["steps"], list) or not run["steps"]:
        raise ValueError("Run must contain steps")
    seen = set()
    for index, step in enumerate(run["steps"]):
        fields = {"stepId", "stepIndex", "parentStepIds", "stepType", "name", "input",
                  "output", "status", "startedAt", "durationMs", "error", "checkpointId"}
        if not isinstance(step, dict) or not fields <= step.keys():
            raise ValueError("Step is missing required fields")
        if RESERVED_LABELS & step.keys():
            raise ValueError("Evaluation labels must remain outside steps")
        identifier = step["stepId"]
        if not isinstance(identifier, str) or not identifier or identifier in seen:
            raise ValueError("Step IDs must be nonempty and unique")
        if type(step["stepIndex"]) is not int or step["stepIndex"] != index:
            raise ValueError("stepIndex must match ordered steps")
        parents = step["parentStepIds"]
        if not isinstance(parents, list) or any(not isinstance(parent, str) or parent not in seen for parent in parents):
            raise ValueError("Dependencies must refer to earlier steps")
        if not isinstance(step["stepType"], str) or step["stepType"] not in STEP_TYPES:
            raise ValueError("Unsupported stepType")
        if not isinstance(step["status"], str) or step["status"] not in {"success", "error", "skipped"}:
            raise ValueError("Invalid step status")
        if not isinstance(step["input"], dict) or not isinstance(step["output"], dict):
            raise ValueError("Step inputs and outputs must be objects")
        duration = step["durationMs"]
        if type(duration) not in {int, float} or not math.isfinite(duration) or duration < 0:
            raise ValueError("durationMs must be finite and nonnegative")
        if not isinstance(step["startedAt"], str):
            raise ValueError("startedAt must be an ISO timestamp string")
        stamp = datetime.fromisoformat(step["startedAt"])
        if stamp.tzinfo is None:
            raise ValueError("startedAt must include a timezone")
        if step["error"] is not None and not isinstance(step["error"], dict):
            raise ValueError("error must be an object or null")
        if step["checkpointId"] is not None and not isinstance(step["checkpointId"], str):
            raise ValueError("checkpointId must be a string or null")
        seen.add(identifier)
    if run["source"] == "synthetic-controlled-workflow":
        order = ["retrieval", "selection", "calculation", "generation", "validation"]
        if [step["stepType"] for step in run["steps"]] != order:
            raise ValueError("Controlled workflow requires the five ordered arithmetic steps")
        for step in run["steps"]:
            _validate_arithmetic_step(step)


def validate_labels(runs, labels):
    for run in runs:
        validate_run(run)
    by_id = {run["runId"]: run for run in runs}
    if len(by_id) != len(runs) or len(labels) != len(runs):
        raise ValueError("Runs and labels must have unique one-to-one IDs")
    visited = set()
    for label in labels:
        fields = {"runId", "scenarioId", "failureType", "rootCauseStepId"}
        if not isinstance(label, dict) or not fields <= label.keys():
            raise ValueError("Label is missing required fields")
        if not isinstance(label["scenarioId"], str) or not label["scenarioId"]:
            raise ValueError("scenarioId must be a nonempty string")
        if not isinstance(label["runId"], str):
            raise ValueError("Label runId must be a string")
        if not isinstance(label["failureType"], str) or label["failureType"] not in {"normal", "tool_error", "invalid_selection", "calculation_error", "answer_mismatch"}:
            raise ValueError("Unsupported evaluation failure type")
        identifier = label["runId"]
        if identifier not in by_id or identifier in visited:
            raise ValueError("Unknown or duplicate label runId")
        run = by_id[identifier]
        root = label["rootCauseStepId"]
        if root is not None and not isinstance(root, str):
            raise ValueError("Root cause must be a step ID or null")
        if root is not None and root not in {s["stepId"] for s in run["steps"]}:
            raise ValueError("Root cause must refer to a step")
        if (root is None) != (label["failureType"] == "normal"):
            raise ValueError("Normal labels must have no root cause")
        if (root is None) != (run["status"] == "success"):
            raise ValueError("Run outcome and evaluation label disagree")
        visited.add(identifier)
