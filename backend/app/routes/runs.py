from fastapi import APIRouter, HTTPException, Request

from backend.app.schemas import AgentRun, ExecuteRequest, ReplayRequest, ReplayResult, TraceStep
from backend.app.services.workflow import WORKFLOW_VERSION, compare, execute

router = APIRouter(prefix="/runs", tags=["Runs"])


def validate_checkpoint_snapshot(checkpoint, run_id, index, steps, config):
    expected_state = {}
    for step in steps[:index]:
        expected_state.update(step["output"])
    if (not isinstance(checkpoint, dict)
            or checkpoint.get("runId") != run_id
            or checkpoint.get("workflowVersion") != WORKFLOW_VERSION
            or checkpoint.get("stepIndex") != index
            or checkpoint.get("prefix") != steps[:index]
            or checkpoint.get("state") != expected_state
            or checkpoint.get("config") != config):
        raise HTTPException(409, "Checkpoint snapshot is inconsistent with the saved trace")


def find_record(request, run_id):
    record = request.app.state.store.get(run_id)
    if record is None:
        raise HTTPException(404, "Run not found")
    return record


@router.get("", response_model=list[AgentRun])
def get_all_runs(request: Request):
    return request.app.state.store.list_runs()


@router.post("", response_model=AgentRun, status_code=201)
def create_run(body: ExecuteRequest, request: Request):
    record, checkpoints = execute(body.model_dump())
    request.app.state.store.save(record, checkpoints)
    return record["public"]


@router.get("/{run_id}", response_model=AgentRun)
def get_run(run_id: str, request: Request):
    return find_record(request, run_id)["public"]


@router.get("/{run_id}/trace", response_model=list[TraceStep])
def get_run_trace(run_id: str, request: Request):
    return find_record(request, run_id)["public"]["steps"]


@router.get("/{run_id}/observed")
def get_observed_trace(run_id: str, request: Request):
    trace = find_record(request, run_id).get("observed")
    if trace is None:
        raise HTTPException(409, "This legacy fixture has no structured observed trace")
    return trace


@router.post("/{run_id}/replay", response_model=ReplayResult, status_code=201)
def replay_run(run_id: str, body: ReplayRequest, request: Request):
    store = request.app.state.store
    original = find_record(request, run_id)
    if original.get("observed") is None:
        raise HTTPException(409, "Legacy fixture has no restorable checkpoints")
    step = original["observed"]["steps"][body.checkpointStep - 1]
    checkpoint_id = step["checkpointId"]
    if body.checkpointId and body.checkpointId != checkpoint_id:
        raise HTTPException(400, "checkpointId does not match checkpointStep")
    checkpoint = store.checkpoint(checkpoint_id)
    if checkpoint is None or checkpoint.get("runId") != run_id:
        raise HTTPException(409, "Checkpoint is unavailable")
    if checkpoint.get("workflowVersion") != WORKFLOW_VERSION:
        raise HTTPException(409, "Checkpoint workflow version is unsupported")
    prefix = [store.checkpoint(item["checkpointId"]) for item in original["observed"]["steps"][:body.checkpointStep - 1]]
    if any(item is None for item in prefix):
        raise HTTPException(409, "Prefix checkpoints are unavailable")
    try:
        config = ExecuteRequest.model_validate(checkpoint.get("config")).model_dump()
    except ValueError as error:
        raise HTTPException(409, "Checkpoint execution configuration is invalid") from error
    for index, snapshot in enumerate([*prefix, checkpoint]):
        validate_checkpoint_snapshot(snapshot, run_id, index, original["observed"]["steps"], config)
    try:
        replay, checkpoints = execute(checkpoint["config"], checkpoint, prefix, body.alternativeAction.output)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    store.save(replay, checkpoints)
    comparison = compare(original["public"], replay["public"])
    return {"originalRunId": run_id, "replayRunId": replay["public"]["runId"],
            "checkpointStep": body.checkpointStep, "originalOutcome": original["public"]["outcome"],
            "replayOutcome": replay["public"]["outcome"],
            "changedSteps": [item["stepId"] for item in comparison["steps"] if item["changed"]],
            "reusedSteps": [item["stepId"] for item in replay["public"]["steps"] if item["executionMode"] == "reused"],
            "executedSteps": [item["stepId"] for item in replay["public"]["steps"] if item["executionMode"] == "executed"]}
