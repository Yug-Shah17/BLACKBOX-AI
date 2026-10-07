"""Read measured fictional document checks separately from ML metrics."""

import json

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from typing import Literal
from backend.app.services.document_scenarios import scenario_fingerprint, scenarios
from backend.app.services.documents import VERSION

router = APIRouter(tags=["Document workflow"])


FAULT_STEPS = {"missing_retrieval": 1, "wrong_source": 2,
               "unsupported_answer": 3, "incorrect_citation": 3}


class DocumentCase(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    scenario: str
    fault: Literal["missing_retrieval", "wrong_source", "unsupported_answer", "incorrect_citation"]
    expectedStep: int = Field(ge=1, le=3)
    predictedStep: int | None = Field(ge=1, le=4)
    correctedOutcome: Literal["success", "failed"]
    wrongCorrectionOutcome: Literal["success", "failed"]
    originalPreserved: bool
    reusedSteps: list[int]
    executedSteps: list[int]


class DocumentMetrics(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    dataSource: Literal["fictional-demo"]
    diagnosisMode: Literal["rules"]
    workflowVersion: str
    scenarioSha256: str
    caseCount: int = Field(gt=0)
    healthyCaseCount: int = Field(ge=0)
    top1Localization: float = Field(ge=0, le=1)
    fixtureCorrectionSuccessRate: float = Field(ge=0, le=1)
    wrongCorrectionFailureRate: float = Field(ge=0, le=1)
    limitations: str
    cases: list[DocumentCase]


@router.get("/document-evaluation", response_model=DocumentMetrics)
def document_metrics(request: Request):
    try:
        report = json.loads(request.app.state.document_metrics_path.read_text(encoding="utf-8"))
        measured = DocumentMetrics.model_validate(report)
        if measured.caseCount != len(measured.cases):
            raise ValueError("Case count mismatch")
        if measured.workflowVersion != VERSION or measured.scenarioSha256 != scenario_fingerprint():
            raise ValueError("Document report version or scenario fingerprint mismatch")
        expected = {(scenario["id"], fault) for scenario in scenarios() for fault in FAULT_STEPS}
        actual = {(case.scenario, case.fault) for case in measured.cases}
        if actual != expected or len(actual) != measured.caseCount or measured.healthyCaseCount != len(scenarios()):
            raise ValueError("Document report scenario coverage mismatch")
        for case in measured.cases:
            if (case.expectedStep != FAULT_STEPS[case.fault]
                    or case.reusedSteps != list(range(1, case.expectedStep))
                    or case.executedSteps != list(range(case.expectedStep, 5))):
                raise ValueError("Document report checkpoint evidence mismatch")
        rates = (
            (measured.top1Localization, sum(case.predictedStep == case.expectedStep for case in measured.cases)),
            (measured.fixtureCorrectionSuccessRate, sum(case.correctedOutcome == "success" for case in measured.cases)),
            (measured.wrongCorrectionFailureRate, sum(case.wrongCorrectionOutcome == "failed" for case in measured.cases)),
        )
        if any(rate != numerator / measured.caseCount for rate, numerator in rates):
            raise ValueError("Document report aggregate mismatch")
        return measured
    except (OSError, ValueError, TypeError) as error:
        raise HTTPException(503, "Document evaluation is unavailable; run the document benchmark") from error
