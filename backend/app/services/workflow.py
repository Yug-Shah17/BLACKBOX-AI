"""Execute and checkpoint a bounded arithmetic workflow with local tools."""

import copy
import json
import time
from datetime import datetime, timezone
from uuid import uuid4

from ml.trace_schema import SCHEMA_VERSION, validate_run

KINDS = ("retrieval", "selection", "calculation", "generation", "validation")
WORKFLOW_VERSION = "arithmetic-demo-v1"


def validate_override(index, output):
    def integer(value):
        return type(value) is int and abs(value) <= 10_000_000

    valid = False
    if index == 0 and set(output) == {"documents"}:
        documents = output["documents"]
        valid = isinstance(documents, list) and len(documents) == 1
        if valid:
            document = documents[0]
            valid = (isinstance(document, dict) and set(document) == {"documentId", "values"}
                     and isinstance(document["documentId"], str) and bool(document["documentId"])
                     and isinstance(document["values"], list) and len(document["values"]) == 2
                     and all(integer(value) for value in document["values"]))
    elif index == 1:
        valid = set(output) == {"documentId"} and isinstance(output["documentId"], str) and bool(output["documentId"])
    elif index in (2, 3):
        key = "result" if index == 2 else "answer"
        valid = set(output) == {key} and (output[key] is None or integer(output[key]))
    if not valid:
        raise ValueError("Override output does not match this checkpoint's step type")


def execute_step(index, state, config, override=None):
    fault = config["failureType"]
    error = None
    if index == 0:
        inputs = {"query": "Fetch the primary document"}
        outputs = {"documents": [] if fault == "tool_error" else
                   [{"documentId": "primary", "values": [config["a"], config["b"]]}]}
    elif index == 1:
        inputs = {"documents": state["documents"]}
        outputs = {"documentId": "missing" if fault == "invalid_selection" else "primary"}
    elif index == 2:
        document = next((item for item in state["documents"] if item["documentId"] == state["documentId"]), None)
        values = document["values"] if document else []
        inputs = {"values": values, "operation": "sum"}
        result = sum(values) if values else None
        if fault == "calculation_error" and result is not None:
            result += 4
        outputs = {"result": result}
    elif index == 3:
        inputs = {"result": state["result"]}
        answer = state["result"]
        if fault == "answer_mismatch" and answer is not None:
            answer += 6
        outputs = {"answer": answer}
    else:
        inputs = {"answer": state["answer"], "expected": config["a"] + config["b"]}
        outputs = {"passed": inputs["answer"] == inputs["expected"]}
    if override is not None:
        validate_override(index, override)
        outputs = copy.deepcopy(override)
    if index == 0 and not outputs["documents"]:
        error = {"code": "TOOL_UNAVAILABLE"}
    elif index == 2 and outputs["result"] is None:
        error = {"code": "NO_INPUT"}
    elif index == 4 and not outputs["passed"]:
        error = {"code": "TASK_FAILED"}
    state.update(copy.deepcopy(outputs))
    return inputs, outputs, error


def execute(config, checkpoint=None, prefix_checkpoints=None, override=None):
    run_id = f"run_{uuid4().hex}"
    timestamp = datetime.now(timezone.utc).isoformat()
    steps = copy.deepcopy(checkpoint["prefix"]) if checkpoint else []
    state = copy.deepcopy(checkpoint["state"]) if checkpoint else {}
    start = len(steps)
    checkpoints = {}
    # Clone restorable prefix snapshots; no prefix tool is executed again.
    for index, step in enumerate(steps):
        checkpoint_id = f"{run_id}-checkpoint-{index + 1}"
        snapshot = copy.deepcopy(prefix_checkpoints[index])
        snapshot["runId"] = run_id
        snapshot["prefix"] = copy.deepcopy(steps[:index])
        checkpoints[checkpoint_id] = snapshot
        step["checkpointId"] = checkpoint_id
        step["executionMode"] = "reused"
    for index in range(start, len(KINDS)):
        checkpoint_id = f"{run_id}-checkpoint-{index + 1}"
        checkpoints[checkpoint_id] = {"runId": run_id, "stepIndex": index,
                                      "workflowVersion": WORKFLOW_VERSION, "config": copy.deepcopy(config),
                                      "state": copy.deepcopy(state), "prefix": copy.deepcopy(steps)}
        started_at = datetime.now(timezone.utc).isoformat()
        timer = time.perf_counter()
        inputs, outputs, error = execute_step(index, state, config, override if index == start else None)
        duration = round((time.perf_counter() - timer) * 1000, 4)
        steps.append({"stepId": f"{run_id}-step-{index}", "stepIndex": index,
                      "parentStepIds": [steps[-1]["stepId"]] if steps else [],
                      "stepType": KINDS[index], "name": KINDS[index],
                      "input": inputs, "output": outputs, "status": "error" if error else "success",
                      "error": error, "startedAt": started_at, "durationMs": duration,
                      "checkpointId": checkpoint_id, "executionMode": "executed"})
    observed = {"runId": run_id, "schemaVersion": SCHEMA_VERSION,
                "source": "synthetic-controlled-workflow", "task": "Sum the primary document values",
                "status": "success" if state["passed"] else "failed", "steps": steps,
                "finalOutput": {"answer": state["answer"]}}
    validate_run(observed)
    public_steps = [{"stepId": index + 1, "traceStepId": step["stepId"], "stepType": step["stepType"],
                     "input": json.dumps(step["input"]), "output": json.dumps(step["output"]),
                     "inputData": step["input"], "outputData": step["output"],
                     "toolName": "document_store" if index == 0 else None,
                     "parentStepIds": [index] if index else [], "latencyMs": step["durationMs"],
                     "tokenCount": 0, "retryCount": 0, "status": step["status"], "error": step["error"],
                     "checkpointId": step["checkpointId"], "executionMode": step["executionMode"]}
                    for index, step in enumerate(steps)]
    public = {"runId": run_id, "task": observed["task"], "agentName": "local-arithmetic-agent",
              "outcome": observed["status"], "timestamp": timestamp,
              "durationMs": sum(step["durationMs"] for step in steps if step["executionMode"] == "executed"),
              "steps": public_steps, "schemaVersion": SCHEMA_VERSION,
              "source": observed["source"], "parentRunId": checkpoint["runId"] if checkpoint else None,
              "replayCheckpointStep": start + 1 if checkpoint else None}
    return {"public": public, "observed": observed}, checkpoints


def compare(original, replay):
    columns = ("stepType", "input", "output", "toolName", "status", "error")
    old = {step["stepId"]: step for step in original["steps"]}
    new = {step["stepId"]: step for step in replay["steps"]}
    comparisons = []
    for identifier in sorted(old.keys() | new.keys()):
        left, right = old.get(identifier), new.get(identifier)
        changed = left is None or right is None or any(left.get(key) != right.get(key) for key in columns)
        comparisons.append({"stepId": identifier, "changed": changed, "original": left, "replay": right})
    return {"originalRunId": original["runId"], "replayRunId": replay["runId"],
            "divergenceStep": next((step["stepId"] for step in comparisons if step["changed"]), None),
            "originalOutcome": original["outcome"], "replayOutcome": replay["outcome"], "steps": comparisons}
