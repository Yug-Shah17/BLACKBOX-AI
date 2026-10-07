from fastapi import APIRouter, Request

from backend.app.routes.runs import find_record
from backend.app.schemas import AgentRun, Diagnosis, RunReference

router = APIRouter(tags=["Diagnosis"])


@router.post("/diagnose", response_model=Diagnosis)
def diagnose_run(body: RunReference | AgentRun, request: Request):
    # Use the saved observed trace, never frontend prediction annotations.
    record = find_record(request, body.runId)
    return request.app.state.diagnoser.diagnose(record)
