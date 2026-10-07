import {
  AgentRun,
  Diagnosis,
  ModelMetrics,
  ReplayRequest,
  ReplayResult,
  TraceStep,
} from "@/types/telemetry";
import { MOCK_RUNS } from "../mock-data/runs";
import { MOCK_DIAGNOSES } from "../mock-data/diagnoses";
import { MOCK_METRICS } from "../mock-data/metrics";
import { MOCK_TRACE_SHOWCASE_REPLAY } from "../mock-data/traces";

// In-memory store initialized with mock data
let runsStore: AgentRun[] = [...MOCK_RUNS];
const diagnosesStore: Record<string, Diagnosis> = { ...MOCK_DIAGNOSES };

/**
 * Service layer abstraction for Black Box AI Agent Flight Recorder.
 * Backend engineers can replace these internal mock resolutions with
 * fetch() / gRPC / WebSocket calls without altering frontend components.
 */

export async function getRuns(): Promise<AgentRun[]> {
  // Simulate small network delay
  await new Promise((resolve) => setTimeout(resolve, 60));
  return [...runsStore];
}

export async function getRun(runId: string): Promise<AgentRun | null> {
  await new Promise((resolve) => setTimeout(resolve, 40));
  const found = runsStore.find((r) => r.runId === runId);
  return found ? { ...found } : null;
}

export async function getRunTrace(runId: string): Promise<TraceStep[]> {
  await new Promise((resolve) => setTimeout(resolve, 50));
  const run = runsStore.find((r) => r.runId === runId);
  return run ? [...run.steps] : [];
}

export async function getDiagnosis(runId: string): Promise<Diagnosis | null> {
  await new Promise((resolve) => setTimeout(resolve, 70));
  if (diagnosesStore[runId]) {
    return { ...diagnosesStore[runId] };
  }
  // Fallback diagnosis generation for any other run
  const run = runsStore.find((r) => r.runId === runId);
  if (!run || run.outcome === "success") return null;

  return {
    runId,
    predictedFailureStep: run.predictedFailureStep || 1,
    confidence: run.diagnosisConfidence || 0.85,
    failureType: run.failureType || "tool_error",
    explanation: `Automated failure detection localized the divergence to Step ${
      run.predictedFailureStep || 1
    }.`,
    evidence: [
      "Output pattern diverged from historical baseline.",
      "Tool schema response returned unexpected status.",
    ],
  };
}

export async function replayFromCheckpoint(request: ReplayRequest): Promise<ReplayResult> {
  // Simulate execution latency for replay simulation
  await new Promise((resolve) => setTimeout(resolve, 950));

  const originalRun = runsStore.find((r) => r.runId === request.runId);
  const replayRunId = `${request.runId}_replay_${Date.now().toString().slice(-4)}`;

  // If replaying showcase run run_0142, return high-fidelity repaired trace
  if (request.runId.startsWith("run_0142")) {
    const replayRun: AgentRun = {
      runId: replayRunId,
      task: originalRun ? originalRun.task : "Find the cheapest flight from Mumbai to Bengaluru tomorrow",
      agentName: originalRun ? originalRun.agentName : "Voyager-Travel-v2",
      outcome: "success",
      durationMs: 7120,
      timestamp: new Date().toISOString(),
      steps: MOCK_TRACE_SHOWCASE_REPLAY.map((s) => ({ ...s })),
      totalTokens: 3100,
    };

    // Store in memory
    runsStore = [replayRun, ...runsStore];

    return {
      originalRunId: request.runId,
      replayRunId: replayRun.runId,
      checkpointStep: request.checkpointStep,
      originalOutcome: "failed",
      replayOutcome: "success",
      changedSteps: [5, 6, 7],
      replayRun,
    };
  }

  // Generic replay fallback
  const baseSteps = originalRun ? originalRun.steps : [];
  const replaySteps: TraceStep[] = baseSteps.map((step) => {
    if (step.stepId < request.checkpointStep) {
      return { ...step };
    }
    if (step.stepId === request.checkpointStep) {
      return {
        ...step,
        title: `${request.toolName || step.toolName || "action"} [REPLAYED]`,
        toolName: request.toolName || step.toolName,
        input: request.alternativeAction,
        output: JSON.stringify({ status: "success", replayed: true, resolved: true }, null, 2),
        status: "success",
        suspicionScore: undefined,
        predictedFailureType: undefined,
        metadata: { ...step.metadata, isReplayDivergencePoint: true },
      };
    }
    return {
      ...step,
      title: `${step.title} (repaired downstream)`,
      status: "success",
      suspicionScore: undefined,
      metadata: { ...step.metadata, repaired: true },
    };
  });

  const replayRun: AgentRun = {
    runId: replayRunId,
    task: originalRun?.task || "Replayed task",
    agentName: originalRun?.agentName || "Agent-v1",
    outcome: "success",
    durationMs: Math.max(3000, (originalRun?.durationMs || 5000) - 800),
    timestamp: new Date().toISOString(),
    steps: replaySteps,
    totalTokens: (originalRun?.totalTokens || 2000) - 200,
  };

  runsStore = [replayRun, ...runsStore];

  return {
    originalRunId: request.runId,
    replayRunId,
    checkpointStep: request.checkpointStep,
    originalOutcome: originalRun?.outcome || "failed",
    replayOutcome: "success",
    changedSteps: replaySteps.filter((s) => s.stepId >= request.checkpointStep).map((s) => s.stepId),
    replayRun,
  };
}

export interface ComparisonData {
  originalRun: AgentRun;
  replayRun: AgentRun;
  checkpointStep: number;
  changedSteps: number[];
  resolved: boolean;
  durationDeltaMs: number;
  tokenDelta: number;
}

export async function compareRuns(
  originalRunId: string,
  replayRunId: string
): Promise<ComparisonData | null> {
  await new Promise((resolve) => setTimeout(resolve, 80));

  const originalRun = runsStore.find((r) => r.runId === originalRunId);
  const replayRun = runsStore.find((r) => r.runId === replayRunId);

  if (!originalRun || !replayRun) return null;

  const checkpointStep = originalRun.predictedFailureStep || 5;
  const changedSteps = replayRun.steps
    .filter((s) => s.stepId >= checkpointStep)
    .map((s) => s.stepId);

  return {
    originalRun,
    replayRun,
    checkpointStep,
    changedSteps,
    resolved: originalRun.outcome === "failed" && replayRun.outcome === "success",
    durationDeltaMs: replayRun.durationMs - originalRun.durationMs,
    tokenDelta: (replayRun.totalTokens || 0) - (originalRun.totalTokens || 0),
  };
}

export async function getModelMetrics(): Promise<ModelMetrics> {
  await new Promise((resolve) => setTimeout(resolve, 50));
  return { ...MOCK_METRICS };
}
