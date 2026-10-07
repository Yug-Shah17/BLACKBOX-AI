export interface RecordedStep {
  stepId: number; traceStepId?: string; stepType: string; input: string; output: string;
  inputData?: Record<string, unknown>; outputData?: Record<string, unknown>;
  toolName?: string | null; latencyMs: number; tokenCount: number; status: string;
  checkpointId?: string | null; executionMode: "executed" | "reused";
}
export interface DemoDocument {
  documentId: string; title: string; topic: string; text: string; current: boolean;
}
export interface DocumentScenario {
  id: string; name: string; dataSource: "fictional-demo"; question: string;
  expectedAnswer: string; expectedCitation: string; documents: DemoDocument[];
}
export interface DocumentContext {
  question: string; documents: DemoDocument[];
}
export interface DocumentMetrics {
  dataSource: "fictional-demo"; diagnosisMode: "rules"; caseCount: number; healthyCaseCount: number;
  top1Localization: number; fixtureCorrectionSuccessRate: number; wrongCorrectionFailureRate: number;
  limitations: string;
  cases: { scenario: string; fault: string; expectedStep: number; predictedStep: number;
    correctedOutcome: string; wrongCorrectionOutcome: string; originalPreserved: boolean }[];
}
export interface RecordedRun {
  runId: string; task: string; agentName: string; outcome: string; timestamp: string;
  durationMs: number; steps: RecordedStep[]; source: string; parentRunId?: string | null;
  replayCheckpointStep?: number | null;
}
export interface RunDiagnosis {
  mode: string;
  runId: string; status: string; predictedFailureStep: number | null; confidence: number | null;
  score: number | null; modelVersion: string | null; explanation: string; evidence: string[];
  suspects: { stepId: number; score?: number; evidence: (string | { field: string; message: string })[] }[];
}
export interface ReplayOutcome {
  originalRunId: string; replayRunId: string; replayOutcome: string;
  changedSteps: number[]; reusedSteps: number[]; executedSteps: number[];
}
export interface TraceDiff {
  originalRunId: string; replayRunId: string; originalOutcome: string; replayOutcome: string;
  divergenceStep: number | null;
  steps: { stepId: number; changed: boolean; original: RecordedStep; replay: RecordedStep }[];
}
export interface EvaluationSlice {
  runCount: number; failedRunCount: number; successfulRunCount: number;
  top1Localization: number | null; top3Localization: number | null;
  successfulRunFalsePositiveRate: number | null; lastErrorTop1Baseline: number | null;
}
export interface MeasuredMetrics {
  modelVersion: string; dataSource: string; trainingRunCount: number; schemaVersion: string;
  splitMethod: string; limitations: string; datasetSha256: string;
  seenFailures: EvaluationSlice; unseenFailure: EvaluationSlice;
}
export async function api<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  let response: Response;
  try {
    response = await fetch(`/api/blackbox${path}`, { method: body === undefined ? "GET" : "POST", cache: "no-store", signal,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: payload });
  } catch (error) {
    if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) throw error;
    throw new Error("Could not reach the local service. Check that Black Box is running, then try again.", { cause: error });
  }
  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const data = await response.json();
      if (typeof data.detail === "string") detail = data.detail;
      else if (Array.isArray(data.detail)) {
        const messages = data.detail.flatMap((issue: unknown) => {
          if (!issue || typeof issue !== "object" || !("msg" in issue) || typeof issue.msg !== "string") return [];
          const location = "loc" in issue && Array.isArray(issue.loc) ? issue.loc
            .filter((part, index) => (typeof part === "string" || typeof part === "number") && !(index === 0 && part === "body")).join(".") : "";
          return [location ? `${location}: ${issue.msg}` : issue.msg];
        });
        if (messages.length) detail = messages.slice(0, 3).join("; ") + (messages.length > 3 ? ` (+${messages.length - 3} more)` : "");
      }
    } catch { /* Proxy errors may not be JSON. */ }
    throw new Error(detail);
  }
  return response.json();
}
export function isDocumentRun(id: string) { return id.startsWith("doc_"); }
export function runBase(id: string) { return isDocumentRun(id) ? "/document-runs" : "/runs"; }
export function runTitle(run: RecordedRun) {
  return run.source === "legacy-fixture" ? "Travel-agent example" : isDocumentRun(run.runId) ? run.task : "Primary document sum";
}
export async function allRuns(signal?: AbortSignal) {
  const groups = await Promise.all([api<RecordedRun[]>("/runs", undefined, signal), api<RecordedRun[]>("/document-runs", undefined, signal)]);
  return groups.flat();
}
export function shortId(id: string) { return id.replace(/^(run_|doc_)/, "").slice(0, 8); }
export function duration(ms: number) { return ms < 1 ? `${ms.toFixed(3)} ms` : ms < 1000 ? `${ms.toFixed(1)} ms` : `${(ms / 1000).toFixed(2)} s`; }
export function percent(value: number | null) { return value === null ? "Not measured" : `${(value * 100).toFixed(0)}%`; }
export function exportJson(value: unknown, name: string) {
  exportFile(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }), name);
}
export function exportFile(file: Blob, name: string) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
