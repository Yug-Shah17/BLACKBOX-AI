export type StepType =
  | "model_call"
  | "tool_call"
  | "retrieval"
  | "decision"
  | "final_answer";

export type RunOutcome =
  | "success"
  | "failed"
  | "running";

export type FailureType =
  | "wrong_tool"
  | "wrong_argument"
  | "bad_retrieval"
  | "incorrect_branch"
  | "tool_error"
  | "timeout"
  | "repeated_action"
  | "premature_completion"
  | "context_loss";

export interface TraceStep {
  stepId: number;
  stepType: StepType;
  title: string;

  input?: string;
  output?: string;

  toolName?: string;

  latencyMs: number;
  tokenCount?: number;
  retryCount?: number;

  status: "success" | "failed" | "warning";

  suspicionScore?: number;
  predictedFailureType?: FailureType;

  metadata?: Record<string, unknown>;
}

export interface AgentRun {
  runId: string;
  task: string;
  agentName: string;

  outcome: RunOutcome;

  durationMs: number;
  timestamp: string;

  steps: TraceStep[];

  predictedFailureStep?: number;
  diagnosisConfidence?: number;
  failureType?: FailureType;
  totalTokens?: number;
}

export interface SuspicionScorePoint {
  stepId: number;
  stepTitle: string;
  score: number;
  isSuspected: boolean;
}

export interface Diagnosis {
  runId: string;

  predictedFailureStep: number;

  confidence: number;

  failureType: FailureType;

  explanation: string;

  evidence: string[];

  suspicionDistribution?: SuspicionScorePoint[];
  suggestedAlternative?: {
    toolName: string;
    arguments: Record<string, unknown>;
    explanation: string;
  };
}

export interface ReplayRequest {
  runId: string;
  checkpointStep: number;
  alternativeAction: string;
  toolName?: string;
  parameters?: Record<string, unknown>;
}

export interface ReplayResult {
  originalRunId: string;
  replayRunId: string;

  checkpointStep: number;

  originalOutcome: RunOutcome;
  replayOutcome: RunOutcome;

  changedSteps: number[];
  replayRun: AgentRun;
}

export interface FailureCategoryStat {
  category: FailureType;
  count: number;
  percentage: number;
  top1Accuracy: number;
}

export interface ModelMetrics {
  top1Accuracy: number;
  top3Accuracy: number;
  totalRunsEvaluated: number;
  successfulRuns: number;
  failedRuns: number;
  averageConfidence: number;
  categoryDistribution: FailureCategoryStat[];
  heldOutEvaluation: {
    dataset: string;
    runsCount: number;
    accuracy: number;
    f1Score: number;
    meanLatencyMs: number;
  }[];
}

export interface DatasetItem {
  id: string;
  task: string;
  agentName: string;
  failureType?: FailureType;
  groundTruthStep?: number;
  split: "train" | "val" | "test";
  stepsCount: number;
  complexity: "low" | "medium" | "high";
}
