"""Document workflow endpoints isolated from the arithmetic model."""

import json

from fastapi import APIRouter, HTTPException, Request

from backend.app.schemas import AgentRun, Diagnosis, ReplayRequest, ReplayResult, TraceComparison
from backend.app.services import documents
from backend.app.services.workflow import compare

router = APIRouter(prefix="/document-runs", tags=["Document workflow"])


def find(request, run_id):
    record = request.app.state.document_store.get(run_id)
    if record is None:
        raise HTTPException(404, "Document run not found")
    try:
        run = record["public"]
        steps = run["steps"]
        if (run.get("schemaVersion") not in (documents.VERSION, documents.LEGACY_VERSION, documents.GEMINI_VERSION)
                or run.get("source") != "controlled-local-document-workflow"
                or len(steps) != len(documents.KINDS)):
            raise ValueError("Unsupported document trace")
        for index, step in enumerate(steps):
            if (step["stepId"] != index + 1 or step["stepType"] != documents.KINDS[index]
                    or not isinstance(step.get("inputData"), dict)
                    or not isinstance(step.get("outputData"), dict)
                    or step.get("checkpointId") != f"{run_id}-checkpoint-{index + 1}"):
                raise ValueError("Invalid recorded document step")
            if json.loads(step["input"]) != step["inputData"] or json.loads(step["output"]) != step["outputData"]:
                raise ValueError("Recorded text and structured observations disagree")
        if (not isinstance(steps[0]["inputData"]["question"], str)
                or not isinstance(steps[0]["outputData"]["documentIds"], list)
                or not all(isinstance(identifier, str) for identifier in steps[0]["outputData"]["documentIds"])
                or "documentId" not in steps[1]["outputData"]
                or set(steps[2]["outputData"]) != {"answer", "citation"}
                or not isinstance(steps[3]["outputData"]["passed"], bool)):
            raise ValueError("Incomplete document observations")
        selected = steps[2]["inputData"]["document"]
        if selected is not None:
            if documents.Document.model_validate(selected).model_dump() != selected:
                raise ValueError("Selected document is not canonical")
        generated = steps[2]["outputData"]
        if any(value is not None and not isinstance(value, str) for value in generated.values()):
            raise ValueError("Invalid recorded answer or citation")
        if steps[1]["outputData"]["documentId"] != (selected["documentId"] if selected else None):
            raise ValueError("Recorded selection and generation source disagree")
        passed = documents.answer_checks(steps[0]["inputData"]["question"], selected, generated,
                                         steps[2]["inputData"], run["schemaVersion"])
        if (steps[3]["outputData"]["passed"] != passed
                or run["outcome"] != ("success" if passed else "failed")):
            raise ValueError("Recorded validation and outcome disagree")
    except (ValueError, KeyError, TypeError) as error:
        raise HTTPException(409, "Stored document trace is incomplete or incompatible") from error
    return record


def saved_config(record):
    try:
        config = documents.DocumentRequest.model_validate(record.get("config")).model_dump()
        for field in ("answeringMode", "allowExternalProcessing"):
            if field not in record["config"]:
                config.pop(field)
        if config != record["config"]:
            raise ValueError("Stored execution configuration is not canonical")
        return config
    except (ValueError, TypeError, KeyError) as error:
        raise HTTPException(409, "Stored document execution configuration is invalid") from error


@router.get("", response_model=list[AgentRun])
def list_runs(request: Request):
    return request.app.state.document_store.list_runs()


@router.post("", response_model=AgentRun, status_code=201)
def create_run(body: documents.DocumentRequest, request: Request):
    record, checkpoints = documents.execute(body.model_dump())
    request.app.state.document_store.save(record, checkpoints)
    return record["public"]


@router.get("/{run_id}", response_model=AgentRun)
def get_run(run_id: str, request: Request):
    return find(request, run_id)["public"]


@router.post("/{run_id}/diagnose", response_model=Diagnosis)
def diagnose(run_id: str, request: Request):
    return documents.diagnose(find(request, run_id))


@router.get("/{run_id}/sources", response_model=documents.DocumentContext)
def source_context(run_id: str, request: Request):
    config = saved_config(find(request, run_id))
    return {"question": config["question"], "documents": config["documents"]}


@router.get("/{run_id}/compare", response_model=TraceComparison)
def compare_runs(run_id: str, replay: str, request: Request):
    original = find(request, run_id)["public"]
    branch = find(request, replay)["public"]
    if branch.get("parentRunId") != run_id:
        raise HTTPException(400, "Replay must be a direct branch of this run")
    return compare(original, branch)


@router.post("/{run_id}/replay", response_model=ReplayResult, status_code=201)
def replay_run(run_id: str, body: ReplayRequest, request: Request):
    if body.checkpointStep > 3:
        raise HTTPException(422, "The final validator cannot be overridden")
    store = request.app.state.document_store
    original = find(request, run_id)
    config = saved_config(original)
    steps = original["public"]["steps"]
    index = body.checkpointStep - 1
    if body.checkpointId and body.checkpointId != steps[index]["checkpointId"]:
        raise HTTPException(400, "checkpointId does not match checkpointStep")
    snapshots = []
    state = {}
    for position, step in enumerate(steps):
        snapshot = store.checkpoint(step["checkpointId"])
        if (not isinstance(snapshot, dict) or snapshot.get("runId") != run_id
                or snapshot.get("workflowVersion") != original["public"]["schemaVersion"]
                or snapshot.get("stepIndex") != position
                or snapshot.get("config") != config
                or snapshot.get("prefix") != steps[:position]
                or snapshot.get("state") != state):
            raise HTTPException(409, "Document checkpoint is missing or inconsistent")
        snapshots.append(snapshot)
        state.update(step["outputData"])
    try:
        replay, checkpoints = documents.execute(config, snapshots[index], snapshots[:index],
                                               body.alternativeAction.output)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    store.save(replay, checkpoints)
    comparison = compare(original["public"], replay["public"])
    return {"originalRunId": run_id, "replayRunId": replay["public"]["runId"],
            "checkpointStep": body.checkpointStep, "originalOutcome": original["public"]["outcome"],
            "replayOutcome": replay["public"]["outcome"],
            "changedSteps": [item["stepId"] for item in comparison["steps"] if item["changed"]],
            "reusedSteps": list(range(1, body.checkpointStep)),
            "executedSteps": list(range(body.checkpointStep, 5))}
