"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Database, Download, FileJson, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { allRuns, api, exportJson, isDocumentRun, MeasuredMetrics, RecordedRun, runBase, runTitle, shortId } from "@/lib/api";
import { ErrorNotice, Loading, Status } from "./primitives";

export default function DataWorkspace() {
  const [runs, setRuns] = useState<RecordedRun[] | null>(null); const [metrics, setMetrics] = useState<MeasuredMetrics | null>(null); const [error, setError] = useState("");
  const [exporting, setExporting] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const exportPending = useRef(false);
  useEffect(() => { const controller = new AbortController(); allRuns(controller.signal).then(value => { if (!controller.signal.aborted) setRuns(value); }).catch(e => { if (!controller.signal.aborted) setError(e.message); }); api<MeasuredMetrics>("/metrics", undefined, controller.signal).then(value => { if (!controller.signal.aborted) setMetrics(value); }).catch(() => {}); return () => controller.abort(); }, [loadAttempt]);
  async function download(run: RecordedRun) {
    if (exportPending.current) return;
    exportPending.current = true;
    setExporting(run.runId); setError("");
    try { const observed = await api(`${runBase(run.runId)}/${run.runId}${isDocumentRun(run.runId) ? "" : "/observed"}`); exportJson(observed, `${shortId(run.runId)}-observed.json`); }
    catch (e) { setError(e instanceof Error ? e.message : "Export failed"); } finally { exportPending.current = false; setExporting(null); }
  }
  return <div className="page"><div className="page-heading"><div><div className="eyebrow">EXECUTION DATA</div><h1>Data & exports</h1><p className="page-subtitle">Observed traces <span className="subtle-dot" /> Separate evaluation labels</p></div><button className="button" disabled={!runs} onClick={() => exportJson(runs, "recorded-runs.json")}><Download size={15} />Export records</button></div>{error && <ErrorNotice message={error} retry={() => { setError(""); setLoadAttempt(attempt => attempt + 1); }} />}
    <div className="data-overview"><Database size={25} /><div><h2>Controlled arithmetic dataset</h2><p>Agent-run schema v1 <span className="subtle-dot" /> Synthetic source</p></div><span className="status neutral">Local dataset</span></div><div className="stats-band"><div className="stat"><span className="stat-label">Training runs</span><strong>{metrics?.trainingRunCount ?? "--"}</strong><small>Measured training split</small></div><div className="stat"><span className="stat-label">Test runs</span><strong>{metrics ? metrics.seenFailures.runCount + metrics.unseenFailure.runCount : "--"}</strong><small>Separate held-out scenarios</small></div><div className="stat"><span className="stat-label">Recorded locally</span><strong>{runs?.length ?? "--"}</strong><small>Persisted backend executions</small></div><div className="stat"><span className="stat-label">Data contract</span><strong className="contract-version">v1</strong><small>Versioned agent-run schema</small></div></div>
    <div className="section-heading"><h2>Recorded trace exports</h2><span className="quiet-label"><ShieldCheck size={13} />Observed data only</span></div>{!runs ? error ? null : <Loading /> : <div className="table-scroll"><table className="runs-table"><thead><tr><th>Execution</th><th>Source</th><th>Outcome</th><th>Steps</th><th>Export</th></tr></thead><tbody>{[...runs].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).map(run => <tr key={run.runId}><td><Link className="run-link" href={`/trace/${run.runId}`}><span className="run-glyph"><FileJson size={16} /></span><span><strong>{runTitle(run)}</strong><small className="mono">{shortId(run.runId)}<ArrowUpRight size={10} /></small></span></Link></td><td className="muted">{run.source === "legacy-fixture" ? "Legacy fixture" : "Controlled execution"}</td><td><Status value={run.outcome} /></td><td className="mono">{run.steps.length}</td><td><button className="icon-button" title="Export observed trace" aria-label={`Export trace ${shortId(run.runId)}`} disabled={run.source === "legacy-fixture" || exporting !== null} onClick={() => download(run)}><Download size={15} /></button></td></tr>)}</tbody></table></div>}
    {metrics && <div className="dataset-fingerprint"><div className="eyebrow">TRAINING DATASET FINGERPRINT</div><code>{metrics.datasetSha256}</code></div>}
  </div>;
}
