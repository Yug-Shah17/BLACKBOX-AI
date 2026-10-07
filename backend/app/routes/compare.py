from fastapi import APIRouter, HTTPException, Request

from backend.app.routes.runs import find_record
from backend.app.schemas import TraceComparison
from backend.app.services.workflow import compare

router = APIRouter(tags=["Compare"])


@router.get("/compare", response_model=TraceComparison)
def compare_traces(original: str, replay: str, request: Request):
    left = find_record(request, original)["public"]
    right = find_record(request, replay)["public"]
    if right.get("parentRunId") != left["runId"]:
        raise HTTPException(400, "Replay must be a direct branch of the original run")
    return compare(left, right)
