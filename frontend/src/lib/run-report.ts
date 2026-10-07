import type { RecordedRun, RunDiagnosis, TraceDiff } from "./api.ts";

export function runReport(run: RecordedRun, diagnosis?: RunDiagnosis | null, comparison?: TraceDiff | null): string {
  const document = run.runId.startsWith("doc_");
  const lines = ["BLACK BOX - RECORDED RUN REPORT", "", `Run: ${run.runId}`, `Task: ${run.task}`,
    `Agent: ${run.agentName}`, `Recorded at: ${run.timestamp}`, `Outcome: ${run.outcome}`, `Source: ${run.source}`,
    ...(run.parentRunId ? [`Parent run: ${run.parentRunId}`] : []), "", "DIAGNOSIS",
    `Mode: ${diagnosis?.mode ?? "unavailable"}`, `Likely failure step: ${diagnosis ? diagnosis.predictedFailureStep ?? "none reported" : "unavailable"}`,
    diagnosis?.explanation ?? "Diagnosis unavailable; no result inferred.",
    ...(diagnosis?.evidence ?? []).map(item => `- ${item}`), "", "RECORDED STEPS",
    ...run.steps.map(step => `${step.stepId}. ${step.stepType}: ${step.status} (${step.executionMode})`)];
  if (comparison) lines.push("", "SELECTED BRANCH COMPARISON",
    `Original: ${comparison.originalRunId} (${comparison.originalOutcome})`,
    `Replay: ${comparison.replayRunId} (${comparison.replayOutcome})`,
    `First divergence: ${comparison.divergenceStep ?? "none"}`,
    `Changed steps: ${comparison.steps.filter(step => step.changed).map(step => step.stepId).join(", ") || "none"}`);
  lines.push("", "LIMITS", "Bounded local prototype, not a general debugger or causal proof.",
    run.source === "legacy-fixture" ? "Imported legacy fixture; no new execution or replay capability is implied."
      : document ? run.agentName === "gemini-document-agent"
        ? "Gemini document answering; diagnosis is rule-based. Evidence checks are not semantic correctness proof."
        : "Document answers are extractive; diagnosis is rule-based, not learned or LLM-powered."
      : "Arithmetic learned ranking is evaluated on synthetic data; no advantage over the strong rule baseline is established.",
    "Source metadata is user-provided. Corrections are manual/fixture-provided, not autonomous repairs.",
    "Raw source text and private fault configuration are omitted from this summary.");
  return lines.join("\n") + "\n";
}
