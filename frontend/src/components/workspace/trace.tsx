"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Braces, Calculator, Check, CheckCheck, ChevronRight, CircleAlert, Copy, FileSearch, GitBranch, GitCompareArrows, LoaderCircle, Play, RotateCcw, ScanLine, ShieldCheck } from "lucide-react";
import { api, DocumentContext, duration, exportFile, isDocumentRun, RecordedRun, ReplayOutcome, runBase, RunDiagnosis, runTitle, shortId, TraceDiff } from "@/lib/api";
import { FileText } from "lucide-react";
import { runReport } from "@/lib/run-report";
import { DocumentEvidence } from "./document-evidence";
import { documentReplacement } from "@/lib/document-replacement";
import { DownloadButton, ErrorNotice, JsonBlock, Loading, Status } from "./primitives";
import { WorkspaceTabs } from "./tabs";

const titles: Record<string, string> = { retrieval: "Retrieve document", selection: "Select evidence", calculation: "Calculate values", generation: "Compose answer", validation: "Validate outcome", decision: "Agent decision", tool_call: "Execute tool", final_answer: "Final answer" };
const icons = { retrieval: FileSearch, selection: ScanLine, calculation: Calculator, generation: Braces, validation: ShieldCheck };
function defaultOutput(run: RecordedRun, index: number, context?: DocumentContext | null) {
  if (isDocumentRun(run.runId)) {
    return documentReplacement(run, index, context);
  }
  const step = run.steps[index - 1]; const data = step?.inputData || {};
  const expected = run.steps.find(s => s.stepType === "validation")?.inputData?.expected;
  if (step?.stepType === "retrieval") return { documents: [{ documentId: "primary", values: [typeof expected === "number" ? expected : 42, 0] }] };
  if (step?.stepType === "selection") return { documentId: "primary" };
  if (step?.stepType === "calculation") return { result: Array.isArray(data.values) && data.values.length ? (data.values as number[]).reduce((a, b) => a + b, 0) : null };
  return { answer: data.result ?? null };
}

function replacementAnswer(value: string): string | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === "object" && "answer" in parsed && typeof parsed.answer === "string") return parsed.answer;
  } catch { return null; }
  return null;
}

export default function TraceWorkspace({ runId }: { runId: string }) {
  const documentWorkflow = isDocumentRun(runId);
  const base = runBase(runId);
  const lastReplayStep = documentWorkflow ? 3 : 4;
  const [run, setRun] = useState<RecordedRun | null>(null); const [diagnosis, setDiagnosis] = useState<RunDiagnosis | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const replayPending = useRef(false);
  const [context, setContext] = useState<DocumentContext | null>(null);
  const [contextError, setContextError] = useState("");
  const [error, setError] = useState(""); const [diagnosisError, setDiagnosisError] = useState(""); const [loading, setLoading] = useState(true);
  const [tab, setTabState] = useState("overview"); const [selected, setSelected] = useState(3); const [inspector, setInspector] = useState("output");
  const [replacement, setReplacement] = useState(""); const [replaying, setReplaying] = useState(false); const [replayError, setReplayError] = useState("");
  const [branches, setBranches] = useState<Pick<RecordedRun, "runId" | "parentRunId" | "outcome">[]>([]);
  const [pair, setPair] = useState<{ original: string; replay: string } | null>(null); const [diff, setDiff] = useState<TraceDiff | null>(null);
  const [comparisonAttempt, setComparisonAttempt] = useState(0);
  const [diffFailure, setDiffFailure] = useState<{ key: string; message: string } | null>(null);
  const comparisonKey = pair ? `${pair.original}:${pair.replay}:${comparisonAttempt}` : "";
  const diffError = diffFailure?.key === comparisonKey ? diffFailure.message : "";
  const [changedOnly, setChangedOnly] = useState(false); const [copied, setCopied] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    Promise.allSettled([api<RecordedRun>(`${base}/${encodeURIComponent(runId)}`, undefined, controller.signal), api<RunDiagnosis>(documentWorkflow ? `${base}/${encodeURIComponent(runId)}/diagnose` : "/diagnose", documentWorkflow ? {} : { runId }, controller.signal), api<RecordedRun[]>(base, undefined, controller.signal), documentWorkflow ? api<DocumentContext>(`${base}/${encodeURIComponent(runId)}/sources`, undefined, controller.signal) : Promise.resolve(null)]).then(results => {
      if (controller.signal.aborted) return;
      const [record, prediction, history, sources] = results;
      if (record.status === "rejected") { setError(record.reason.message); setLoading(false); return; }
      const current = record.value; setRun(current);
      const index = prediction.status === "fulfilled" && prediction.value.predictedFailureStep ? prediction.value.predictedFailureStep : Math.min(3, current.steps.length);
      const sourceContext = sources.status === "fulfilled" ? sources.value : null;
      setContext(sourceContext);
      if (sources.status === "rejected") setContextError(sources.reason.message);
      setSelected(index); setReplacement(JSON.stringify(defaultOutput(current, index, sourceContext), null, 2));
      if (prediction.status === "fulfilled") setDiagnosis(prediction.value); else setDiagnosisError(prediction.reason.message);
      if (history.status === "fulfilled") {
        const children = history.value.filter(r => r.parentRunId === runId).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        setBranches(current.parentRunId ? [current, ...children] : children);
        if (current.parentRunId) setPair({ original: current.parentRunId, replay: current.runId });
        else if (children[0]) setPair({ original: runId, replay: children[0].runId });
      }
      setLoading(false);
    });
    return () => controller.abort();
  }, [runId, base, documentWorkflow, loadAttempt]);
  useEffect(() => {
    if (!pair) return;
    const controller = new AbortController();
    const path = documentWorkflow ? `${base}/${encodeURIComponent(pair.original)}/compare?replay=${encodeURIComponent(pair.replay)}` : `/compare?original=${encodeURIComponent(pair.original)}&replay=${encodeURIComponent(pair.replay)}`;
    api<TraceDiff>(path, undefined, controller.signal).then(value => { if (!controller.signal.aborted) { setDiff(value); setDiffFailure(null); } }).catch(e => { if (!controller.signal.aborted) setDiffFailure({ key: comparisonKey, message: e.message }); });
    return () => controller.abort();
  }, [pair, base, documentWorkflow, comparisonKey]);
  function chooseStep(id: number) { setSelected(id); if (run) setReplacement(JSON.stringify(defaultOutput(run, id, context), null, 2)); setReplayError(""); }
  function setTab(value: string) {
    if (value === "replay" && selected > lastReplayStep) chooseStep(3);
    setTabState(value);
  }
  async function replay(event: React.FormEvent) {
    event.preventDefault();
    if (replayPending.current) return;
    replayPending.current = true; setReplaying(true); setReplayError("");
    try {
      const output = JSON.parse(replacement);
      if (!output || Array.isArray(output) || typeof output !== "object") throw new Error("Replacement output must be a JSON object");
      const result = await api<ReplayOutcome>(`${base}/${encodeURIComponent(runId)}/replay`, { checkpointStep: selected, alternativeAction: { type: "replace_output", output } });
      const branch = { runId: result.replayRunId, parentRunId: runId, outcome: result.replayOutcome };
      setBranches(previous => [branch, ...previous]); setPair({ original: runId, replay: result.replayRunId }); setDiff(null); setTab("comparison");
    } catch (e) { setReplayError(e instanceof Error ? e.message : "Replay failed"); } finally { replayPending.current = false; setReplaying(false); }
  }
  if (loading) return <div className="page"><Loading /></div>;
  if (error || !run) return <div className="page"><Link href="/runs" className="back-link"><ArrowLeft size={14} />Execution runs</Link><ErrorNotice message={error || "Run not found"} retry={() => { setLoading(true); setError(""); setDiagnosisError(""); setContextError(""); setLoadAttempt(attempt => attempt + 1); }} /></div>;
  const step = run.steps.find(s => s.stepId === selected); const suspected = diagnosis?.predictedFailureStep;
  const supportsReplay = run.source !== "legacy-fixture"; const canReplay = supportsReplay && !!step?.checkpointId && selected <= lastReplayStep;
  const rootStep = run.steps.find(s => s.stepId === suspected);
  const answerModel = run.steps.find(s => s.stepType === "generation")?.inputData?.model;
  const editableAnswer = documentWorkflow && step?.stepType === "generation" ? replacementAnswer(replacement) : null;
  function changeReplayAnswer(value: string) {
    try {
      const parsed: unknown = JSON.parse(replacement);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) setReplacement(JSON.stringify({ ...parsed, answer: value }, null, 2));
    } catch { setReplayError("Restore valid replacement JSON before editing the answer."); }
  }
  const comparedAnswer = diff?.steps.find(item => item.original?.stepType === "generation");
  const replayResult = diff ? {
    reusedSteps: diff.steps.filter(item => item.replay.executionMode === "reused"),
    executedSteps: diff.steps.filter(item => item.replay.executionMode === "executed"),
    changedSteps: diff.steps.filter(item => item.changed),
  } : null;
  return <div className="page trace-page">
    <Link href="/runs" className="back-link"><ArrowLeft size={14} />Execution runs</Link>
    <div className="page-heading trace-heading"><div><h1>{runTitle(run)}</h1><div className="trace-run-line"><span className="mono">RUN / {shortId(runId)}</span><Status value={run.outcome} />{run.parentRunId && <span className="quiet-label"><GitBranch size={12} />Replay branch</span>}</div><p className="page-subtitle">{run.agentName}<span className="subtle-dot" />{new Date(run.timestamp).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}<span className="subtle-dot" />{duration(run.durationMs)}</p></div><div className="heading-actions"><DownloadButton value={run} name={`${shortId(runId)}.json`} /><button className="button primary" disabled={!supportsReplay} onClick={() => { chooseStep(suspected || 3); setTab("replay"); }}><RotateCcw size={15} />Replay run</button></div></div>
    <div className="trace-meta"><span><span className="meta-label">WORKFLOW</span>{documentWorkflow ? "Document QA" : "Arithmetic demo"}</span><span><span className="meta-label">STEPS</span>{run.steps.length} recorded</span><span><span className="meta-label">SOURCE</span>{supportsReplay ? "Controlled execution" : "Legacy fixture"}</span><span><span className="meta-label">MODEL</span>{documentWorkflow ? typeof answerModel === "string" ? answerModel : "Local deterministic" : diagnosis?.modelVersion || "Unavailable"}</span><button type="button" className="icon-button" aria-label="Download run report" title="Download run report" onClick={() => exportFile(new Blob([runReport(run, diagnosis, diff)], { type: "text/plain;charset=utf-8" }), `${shortId(runId)}-report.txt`)}><FileText size={16} /></button></div>
    <WorkspaceTabs label="Trace views" value={tab} onChange={setTab} items={[{ id: "overview", label: "Trace overview", icon: <ScanLine size={14} /> }, { id: "replay", label: "Checkpoint replay", icon: <RotateCcw size={14} /> }, { id: "comparison", label: "Compare branches", icon: <GitCompareArrows size={14} />, count: branches.length }]}>
    {tab === "overview" && <>
      {run.outcome === "failed" && diagnosis?.predictedFailureStep && <section className="trace-finding" aria-label="Investigation finding"><div><CircleAlert size={20} /><div><h2>Start with {rootStep ? titles[rootStep.stepType] || rootStep.stepType : "the flagged step"}</h2><p>{diagnosis.evidence[0] || "Recorded checks flagged this stage for investigation."}</p></div></div><button className="button" disabled={!supportsReplay} onClick={() => { chooseStep(diagnosis.predictedFailureStep || 3); setTab("replay"); }}><GitBranch size={15} />Test a correction<ArrowRight size={15} /></button></section>}
      {documentWorkflow && <DocumentEvidence run={run} context={context} error={contextError} />}
      <div className="trace-flow" aria-label="Execution graph" style={{ gridTemplateColumns: `repeat(${Math.max(1, run.steps.length)}, minmax(0, 1fr))` }}>{run.steps.map(item => { const Icon = icons[item.stepType as keyof typeof icons] || Braces; return <button key={item.stepId} className={`flow-node ${item.stepId === selected ? "selected" : ""} ${item.stepId === suspected ? "suspect" : ""}`} aria-pressed={item.stepId === selected} onClick={() => chooseStep(item.stepId)} aria-label={`Inspect step ${item.stepId}: ${titles[item.stepType] || item.stepType}`}><span className="flow-icon"><Icon size={17} /></span><span className="flow-caption"><small>STEP {String(item.stepId).padStart(2, "0")}</small><strong>{titles[item.stepType] || item.stepType}</strong></span>{item.stepId === suspected ? <CircleAlert size={13} className="red" /> : item.status === "error" || item.status === "failed" ? <CircleAlert size={13} className="red" /> : <Check size={13} className="green" />}</button>; })}</div>
      <div className="trace-grid"><section className="execution-panel"><div className="section-heading"><h2>Execution timeline</h2><span className="quiet-label">{run.steps.length} steps <span className="subtle-dot" />{duration(run.durationMs)}</span></div><div className="timeline">{run.steps.map(item => <button key={item.stepId} className={`timeline-step ${selected === item.stepId ? "selected" : ""} ${suspected === item.stepId ? "suspect" : ""}`} aria-pressed={selected === item.stepId} onClick={() => chooseStep(item.stepId)}><span className="timeline-index mono">{String(item.stepId).padStart(2, "0")}</span><span className="timeline-copy"><strong>{titles[item.stepType] || item.stepType}</strong><small>{item.toolName || item.stepType}{item.executionMode === "reused" && " / reused"}</small></span><span className="timeline-end">{item.stepId === suspected ? <span className="suspect-label"><CircleAlert size={11} />Suspect</span> : <Status value={item.status} label={item.status === "success" ? "Passed" : undefined} />}<small className="mono">{duration(item.latencyMs)}</small></span><ChevronRight size={14} /></button>)}</div>
      {step && <div className="step-inspector"><div className="inspector-heading"><span className="mono">STEP {String(selected).padStart(2, "0")}</span><h3>{titles[step.stepType] || step.stepType}</h3><button className="icon-button" title="Copy step JSON" aria-label="Copy step JSON" onClick={() => navigator.clipboard.writeText(JSON.stringify(step, null, 2)).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => setCopied(false))}>{copied ? <Check size={14} /> : <Copy size={14} />}</button></div><div className="inspector-tabs"><button onClick={() => setInspector("input")} className={inspector === "input" ? "active" : ""}>Input</button><button onClick={() => setInspector("output")} className={inspector === "output" ? "active" : ""}>Output</button><span className="mono">JSON</span></div><JsonBlock value={inspector === "input" ? step.inputData || { text: step.input } : step.outputData || { text: step.output }} />{canReplay && <button className="text-link" onClick={() => setTab("replay")}><RotateCcw size={13} />Replay from this checkpoint<ArrowRight size={13} /></button>}</div>}
      </section><aside className="diagnosis-panel"><div className="section-heading"><h2><ScanLine size={17} />{documentWorkflow ? "Evidence diagnosis" : "Model diagnosis"}</h2><span className="status neutral">{documentWorkflow ? "Rules" : "Learned"}</span></div>{diagnosisError && <ErrorNotice message={diagnosisError} retry={() => { setDiagnosis(null); setDiagnosisError(""); setLoadAttempt(attempt => attempt + 1); }} />}{diagnosis?.predictedFailureStep ? <><div className="suspect-summary"><div className="suspect-title"><span className="suspect-number mono">{String(suspected).padStart(2, "0")}</span><h3>{rootStep ? titles[rootStep.stepType] || rootStep.stepType : "Suspicious step"}</h3></div><p className="suspect-explanation">Likely failure origin</p>{!documentWorkflow && <><div className="score-row"><span>Ranking score</span><strong className="mono">{diagnosis.score?.toFixed(3)}</strong></div><div className="score-track"><span style={{ width: `${(diagnosis.score || 0) * 100}%` }} /></div><small className="quiet-label">Uncalibrated model score</small></>}</div><div className="evidence-section"><h3 className="panel-label">Supporting evidence</h3>{diagnosis.evidence.map((item, index) => <div className="evidence-row" key={index}><CircleAlert size={14} /><p>{item}</p></div>)}{rootStep?.stepType === "calculation" && <dl className="evidence-values"><div><dt>Observed result</dt><dd className="red mono">{String(rootStep.outputData?.result)}</dd></div><div><dt>Input values</dt><dd className="mono">{JSON.stringify(rootStep.inputData?.values)}</dd></div></dl>}</div>{!documentWorkflow && <div className="ranking-section"><h3 className="panel-label">Step ranking</h3>{diagnosis.suspects.map(item => <button key={item.stepId} className="ranking-row" aria-label={`Inspect ranked step ${item.stepId}, score ${(item.score ?? 0).toFixed(3)}`} onClick={() => chooseStep(item.stepId)}><span className="mono">{String(item.stepId).padStart(2, "0")}</span><span className="ranking-bar"><i style={{ width: `${(item.score ?? 0) * 100}%` }} /></span><span className="mono">{(item.score ?? 0).toFixed(3)}</span></button>)}</div>}<button className="button primary full-width" disabled={!supportsReplay} onClick={() => { chooseStep(suspected || 3); setTab("replay"); }}><GitBranch size={14} />Test an alternative<ArrowRight size={14} /></button></> : <div className="diagnosis-empty"><ShieldCheck size={30} /><h3>{!diagnosis ? "Diagnosis unavailable" : diagnosis.status === "unsupported_trace" ? "Unsupported trace" : "No suspicious step"}</h3><p>{!diagnosis ? "No diagnosis result was received. The recorded execution is still available for inspection." : diagnosis.status === "unsupported_trace" ? "Legacy fixture outside the model's supported workflow." : "Insufficient evidence of a faulty step in this execution."}</p></div>}<div className="model-footnote"><span className="connection-dot connected" />{documentWorkflow ? "Local evidence checks" : diagnosis?.modelVersion || "No model result"}<span>{documentWorkflow ? "Controlled document workflow" : "Controlled arithmetic workflow"}</span></div></aside></div>
    </>}
    {tab === "replay" && <div className="replay-grid"><section><div className="section-heading"><h2>Alternative execution</h2><span className="quiet-label"><GitBranch size={13} />New branch</span></div>{!supportsReplay ? <ErrorNotice message="This legacy fixture has no restorable checkpoints." /> : <form className="replay-form" onSubmit={replay}><label>Checkpoint<select aria-label="Replay checkpoint" disabled={replaying} value={selected > lastReplayStep ? 3 : selected} onChange={e => chooseStep(Number(e.target.value))}>{run.steps.filter(s => s.stepId <= lastReplayStep).map(s => <option key={s.stepId} value={s.stepId}>Step {String(s.stepId).padStart(2, "0")} / {titles[s.stepType] || s.stepType}</option>)}</select></label>{editableAnswer !== null && <label className="replay-answer-label">Alternative answer<textarea aria-label="Alternative answer" rows={3} maxLength={10000} value={editableAnswer} disabled={replaying} onChange={event => changeReplayAnswer(event.target.value)} /></label>}<div className="replacement-heading"><label htmlFor="replacement-output">Replacement output</label><span className="mono">JSON</span></div><textarea id="replacement-output" disabled={replaying} className="mono" spellCheck={false} rows={10} value={replacement} onChange={e => setReplacement(e.target.value)} />{replayError && <ErrorNotice message={replayError} />}<div className="replay-submit"><span className="quiet-label">Original execution preserved</span><button className="button primary" disabled={replaying || !canReplay}>{replaying ? <LoaderCircle size={15} className="spin" /> : <Play size={15} />}Execute replay</button></div></form>}</section><aside className="checkpoint-summary"><div className="eyebrow">CHECKPOINT STATE</div><h3>Before step {String(selected > lastReplayStep ? 3 : selected).padStart(2, "0")}</h3><div className="checkpoint-steps">{run.steps.map(s => <div key={s.stepId}><span className={`checkpoint-marker ${s.stepId < selected ? "reused" : ""}`}>{s.stepId < selected ? <CheckCheck size={14} /> : <Play size={12} />}</span><span>{titles[s.stepType] || s.stepType}</span><small>{s.stepId < selected ? "Reuse" : "Execute"}</small></div>)}</div><dl className="evidence-values"><div><dt>Reused prefix</dt><dd>{Math.max(0, selected - 1)} steps</dd></div><div><dt>Executed suffix</dt><dd>{Math.max(0, run.steps.length - selected + 1)} steps</dd></div></dl></aside></div>}
    {tab === "comparison" && <section className="comparison-section">
      <div className="section-heading"><h2>Execution comparison</h2><div className="heading-actions">{branches.length > 0 && <select aria-label="Compare replay branch" className="branch-select" value={pair?.replay || ""} onChange={e => { const branch = branches.find(b => b.runId === e.target.value); if (branch?.parentRunId) { setPair({ original: branch.parentRunId, replay: branch.runId }); setDiff(null); } }}>{branches.map(b => <option key={b.runId} value={b.runId}>{shortId(b.runId)} / {b.outcome}</option>)}</select>}{diff && <DownloadButton value={diff} name={`${shortId(diff.originalRunId)}-${shortId(diff.replayRunId)}-comparison.json`} label="Download comparison" />}</div></div>
      {diffError && <ErrorNotice message={diffError} retry={() => { setDiff(null); setComparisonAttempt(attempt => attempt + 1); }} />}
      {!pair ? <div className="empty-state"><GitCompareArrows size={28} /><h3>No replay branches yet</h3><button className="button" disabled={!supportsReplay} onClick={() => setTab("replay")}><GitBranch size={14} />Create a replay</button></div> : !diff ? (!diffError ? <Loading /> : null) : <>
        <div className="comparison-outcomes"><div><small>ORIGINAL EXECUTION</small><span className="mono">{shortId(diff.originalRunId)}</span><Status value={diff.originalOutcome} /></div><ArrowRight size={20} /><div><small>REPLAY BRANCH</small><Link href={`/trace/${diff.replayRunId}`} className="mono">{shortId(diff.replayRunId)}<ArrowUpRight size={12} /></Link><Status value={diff.replayOutcome} /></div><span className="comparison-verdict">{diff.originalOutcome === "failed" && diff.replayOutcome === "success" ? <><Check size={16} />Outcome improved</> : "Execution recorded"}</span></div>
        {replayResult && <div className="replay-proof"><span><CheckCheck size={14} />{replayResult.reusedSteps.length} steps reused</span><span><Play size={13} />{replayResult.executedSteps.length} steps executed</span><span><GitBranch size={13} />{replayResult.changedSteps.length} steps changed</span></div>}
        {comparedAnswer && <div className="answer-comparison" aria-label="Answer comparison"><section><h3>Original answer</h3><p>{typeof comparedAnswer.original.outputData?.answer === "string" ? comparedAnswer.original.outputData.answer : "No answer recorded"}</p></section><section><h3>Replay answer</h3><p>{typeof comparedAnswer.replay.outputData?.answer === "string" ? comparedAnswer.replay.outputData.answer : "No answer recorded"}</p></section></div>}
        <div className="diff-toolbar"><span className="quiet-label">{diff.divergenceStep ? `First divergence at step ${String(diff.divergenceStep).padStart(2, "0")}` : "No semantic differences"}</span><label><input type="checkbox" checked={changedOnly} onChange={e => setChangedOnly(e.target.checked)} />Changed steps only</label></div>
        <div className="diff-column-labels"><span>STEP</span><span>ORIGINAL OUTPUT</span><span>REPLAY OUTPUT</span></div>
        {diff.steps.filter(item => !changedOnly || item.changed).map(item => <div key={item.stepId} className={`diff-row ${item.changed ? "changed" : ""}`}><div className="diff-step"><span className="mono">{String(item.stepId).padStart(2, "0")}</span><strong>{titles[item.original?.stepType] || item.original?.stepType}</strong><small>{item.changed ? "Changed" : "Unchanged"}</small></div><JsonBlock value={item.original?.outputData || item.original?.output} /><JsonBlock value={item.replay?.outputData || item.replay?.output} /></div>)}
      </>}
    </section>}
    </WorkspaceTabs>
  </div>;
}
