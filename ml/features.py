"""Evidence features for the bounded arithmetic demo; labels are never inputs."""

if __package__:
    from .trace_schema import validate_run
else:
    from trace_schema import validate_run


def step_features(step):
    kind, inputs, outputs = step["stepType"], step["input"], step["output"]
    evidence = []
    mismatch = False
    if kind == "selection":
        docs = inputs.get("documents", [])
        mismatch = bool(docs) and outputs.get("documentId") not in {d["documentId"] for d in docs}
        if mismatch:
            evidence.append({"field": "output.documentId", "message": "Selected document is absent from input.documents"})
    elif kind == "calculation":
        values = inputs.get("values", [])
        mismatch = bool(values) and inputs.get("operation") == "sum" and outputs.get("result") != sum(values)
        if mismatch:
            evidence.append({"field": "output.result", "message": "Result differs from the sum of input.values"})
    elif kind == "generation":
        mismatch = inputs.get("result") is not None and outputs.get("answer") != inputs["result"]
        if mismatch:
            evidence.append({"field": "output.answer", "message": "Answer differs from input.result"})
    explicit_error = step["status"] == "error"
    if explicit_error:
        evidence.append({"field": "error", "message": "Step reports an execution error"})
    missing = any(value is None or value == [] for value in inputs.values())
    if missing:
        evidence.append({"field": "input", "message": "A required demo input is empty or unavailable"})
    return {"stepType": kind, "explicitError": int(explicit_error),
            "localMismatch": int(mismatch), "missingInput": int(missing)}, evidence


def extract_features(run):
    validate_run(run)
    return [step_features(step)[0] for step in run["steps"]]
