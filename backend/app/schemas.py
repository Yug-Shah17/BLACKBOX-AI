"""Display contracts preserve the original API; structured data is additive."""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class TraceStep(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    stepId: int
    stepType: str
    input: str
    output: str
    toolName: str | None = None
    latencyMs: float = Field(ge=0)
    tokenCount: int = Field(default=0, ge=0)
    retryCount: int = Field(default=0, ge=0)
    status: str
    suspicionScore: float | None = None
    predictedFailureType: str | None = None
    traceStepId: str | None = None
    parentStepIds: list[int] = Field(default_factory=list)
    inputData: dict[str, Any] | None = None
    outputData: dict[str, Any] | None = None
    error: dict[str, Any] | None = None
    checkpointId: str | None = None
    executionMode: Literal["executed", "reused"] = "executed"


class AgentRun(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    runId: str
    task: str
    agentName: str
    outcome: str
    durationMs: float = Field(ge=0)
    timestamp: str
    predictedFailureStep: int | None = None
    diagnosisConfidence: float | None = None
    steps: list[TraceStep] = Field(default_factory=list)
    schemaVersion: str | None = None
    source: str = "legacy-fixture"
    parentRunId: str | None = None
    replayCheckpointStep: int | None = None


class RunReference(BaseModel):
    model_config = ConfigDict(extra="forbid")
    runId: str = Field(min_length=1)


class ExecuteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    a: int = Field(default=12, ge=-1_000_000, le=1_000_000, strict=True)
    b: int = Field(default=30, ge=-1_000_000, le=1_000_000, strict=True)
    failureType: Literal["normal", "tool_error", "invalid_selection", "calculation_error", "answer_mismatch"] = "normal"


class AlternativeAction(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: Literal["replace_output"]
    output: dict[str, Any]


class ReplayRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    checkpointStep: int = Field(ge=1, le=4, strict=True)
    checkpointId: str | None = None
    alternativeAction: AlternativeAction


class Diagnosis(BaseModel):
    runId: str
    predictedFailureStep: int | None = None
    confidence: float | None = None
    score: float | None = None
    failureType: str | None = None
    explanation: str
    evidence: list[str] = Field(default_factory=list)
    mode: str = "model"
    status: str
    modelVersion: str | None = None
    suspects: list[dict[str, Any]] = Field(default_factory=list)


class ReplayResult(BaseModel):
    originalRunId: str
    replayRunId: str
    checkpointStep: int
    originalOutcome: str
    replayOutcome: str
    changedSteps: list[int]
    reusedSteps: list[int]
    executedSteps: list[int]


class ComparisonStep(BaseModel):
    stepId: int
    changed: bool
    original: TraceStep | None = None
    replay: TraceStep | None = None


class TraceComparison(BaseModel):
    originalRunId: str
    replayRunId: str
    divergenceStep: int | None
    originalOutcome: str
    replayOutcome: str
    steps: list[ComparisonStep]


class ModelMetrics(BaseModel):
    modelVersion: str
    schemaVersion: str
    dataSource: str
    trainingRunCount: int = Field(ge=0)
    seenFailures: dict[str, Any]
    unseenFailure: dict[str, Any]
    splitMethod: str
    limitations: str
    top1Accuracy: float | None = None
    top3Accuracy: float | None = None
    stepPrecision: float | None = None
    stepRecall: float | None = None
    stepF1: float | None = None
    failureTypeAccuracy: float | None = None
    heldOutTop1Accuracy: float | None = None
    heldOutTop3Accuracy: float | None = None
    datasetSha256: str | None = None
