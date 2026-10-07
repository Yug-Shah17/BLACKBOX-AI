import json

from fastapi import APIRouter, HTTPException, Request
from pydantic import ValidationError

from backend.app.schemas import ModelMetrics

router = APIRouter(tags=["Metrics"])


@router.get("/metrics", response_model=ModelMetrics)
def get_metrics(request: Request):
    path = request.app.state.metrics_path
    if not path.exists():
        raise HTTPException(404, "Measured metrics are not available")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return ModelMetrics.model_validate({**data,
            "top1Accuracy": data["seenFailures"]["top1Localization"],
            "top3Accuracy": data["seenFailures"]["top3Localization"],
            "heldOutTop1Accuracy": data["unseenFailure"]["top1Localization"],
            "heldOutTop3Accuracy": data["unseenFailure"]["top3Localization"]})
    except (OSError, ValueError, KeyError, TypeError, ValidationError) as error:
        raise HTTPException(503, "Measured metrics file is unreadable or incompatible") from error
