"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowDownRight, ArrowRight, ArrowUpRight, Check, ChevronLeft, ChevronRight, CircleAlert, Clock3, FileUp, GitBranch, Layers3, Plus, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import { allRuns, api, duration, isDocumentRun, RecordedRun, runTitle, shortId } from "@/lib/api";
import { NewRunDialog } from "./new-run-dialog";
import { DownloadButton, ErrorNotice, Loading, Status } from "./primitives";

export default function RunsWorkspace() {
  const router = useRouter(); const [runs, setRuns] = useState<RecordedRun[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [filter, setFilter] = useState("all"); const [search, setSearch] = useState("");
  const [workflowFilter, setWorkflowFilter] = useState("all");
  const [sort, setSort] = useState("newest"); const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false); const [createError, setCreateError] = useState("");
  const [workflow, setWorkflow] = useState("documents");
  const [sourceMode, setSourceMode] = useState("demo");
  const dialog = useRef<HTMLDialogElement>(null);
  const creationPending = useRef(false);
  const request = useRef<AbortController | null>(null);
  const loadRuns = useCallback(() => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    allRuns(controller.signal).then(data => { if (!controller.signal.aborted) { setRuns(data); setError(""); } }).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
  }, []);
  const refresh = () => { setLoading(true); loadRuns(); };
  useEffect(() => {
    loadRuns();
    return () => request.current?.abort();
  }, [loadRuns]);
  const successful = runs.filter(r => r.outcome === "success").length;
  const failed = runs.filter(r => r.outcome === "failed").length;
  const replays = runs.filter(r => r.parentRunId).length;
  const query = search.trim().toLowerCase();
  const scopedRuns = runs.filter(run => workflowFilter === "all" || (workflowFilter === "documents" ? isDocumentRun(run.runId) : workflowFilter === "examples" ? run.source === "legacy-fixture" : !isDocumentRun(run.runId) && run.source !== "legacy-fixture"));
  const filterCounts = { all: scopedRuns.length, failed: scopedRuns.filter(run => run.outcome === "failed").length, success: scopedRuns.filter(run => run.outcome === "success").length, replays: scopedRuns.filter(run => run.parentRunId).length };
  const filtered = scopedRuns.filter(r => (filter === "all" || (filter === "replays" ? !!r.parentRunId : r.outcome === filter)) && `${r.runId} ${r.task} ${r.agentName} ${runTitle(r)}`.toLowerCase().includes(query)).sort((a, b) => {
    if (sort === "oldest") return a.timestamp.localeCompare(b.timestamp);
    if (sort === "duration") return b.durationMs - a.durationMs;
    if (sort === "failed" && a.outcome !== b.outcome) return Number(b.outcome === "failed") - Number(a.outcome === "failed");
    return b.timestamp.localeCompare(a.timestamp);
  });
  const pages = Math.max(1, Math.ceil(filtered.length / 8)); const currentPage = Math.min(page, pages);
  const latestFailure = [...scopedRuns].filter(r => r.outcome === "failed" && r.source !== "legacy-fixture").sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  function resetFilters() { setSearch(""); setFilter("all"); setWorkflowFilter("all"); setPage(1); }
  async function createRun(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creationPending.current) return;
    creationPending.current = true;
    const form = new FormData(event.currentTarget); setCreating(true); setCreateError("");
    try {
      const question = String(form.get("question") ?? "").trim();
      if (workflow === "documents" && !question) throw new Error("Enter a question containing text.");
      const payload = workflow === "documents" ? { question, documents: JSON.parse(String(form.get("documents"))), failureType: form.get("fault"), answeringMode: form.get("answeringMode"), allowExternalProcessing: form.get("allowExternalProcessing") === "on" } : { a: Number(form.get("a")), b: Number(form.get("b")), failureType: form.get("fault") };
      const run = await api<RecordedRun>(workflow === "documents" ? "/document-runs" : "/runs", payload);
      dialog.current?.close(); router.push(`/trace/${run.runId}`);
    }
    catch (e) { setCreateError(e instanceof Error ? e.message : "Execution failed"); } finally { creationPending.current = false; setCreating(false); }
  }
  return <div className="page runs-page">
    <div className="page-heading"><div><div className="eyebrow">OBSERVABILITY</div><h1>Execution runs</h1><p className="page-subtitle">Personal workspace <span className="subtle-dot" /> Local agent history</p></div><div className="heading-actions"><button className="icon-button" title="Refresh runs" aria-label="Refresh runs" onClick={refresh} disabled={loading}><RefreshCw size={16} className={loading ? "spin" : ""} /></button><button className="button primary" onClick={() => { setCreateError(""); dialog.current?.showModal(); }}><Plus size={16} />New run</button></div></div>
    <section className="run-start" aria-label="Start a document execution"><div><h2>Ask a document. Inspect the answer.</h2><p>Bring a TXT, MD, PDF or DOCX, or explore a fictional example.</p></div><div className="heading-actions"><button className="button primary" onClick={() => { setWorkflow("documents"); setSourceMode("upload"); setCreateError(""); dialog.current?.showModal(); }}><FileUp size={17} />Upload document</button><button className="button" onClick={() => { setWorkflow("documents"); setSourceMode("demo"); setCreateError(""); dialog.current?.showModal(); }}><ArrowRight size={17} />Try example</button></div></section>
    <div className="stats-band">
      {[{ name: "Recorded runs", value: runs.length.toString().padStart(2, "0"), icon: Layers3, note: "All recorded executions" }, { name: "Successful", value: successful.toString().padStart(2, "0"), icon: Check, note: runs.length ? `${Math.round(successful / runs.length * 100)}% of recorded runs` : "No executions yet", color: "green" }, { name: "Failed", value: failed.toString().padStart(2, "0"), icon: ArrowDownRight, note: "Available for investigation", color: "red" }, { name: "Replay branches", value: replays.toString().padStart(2, "0"), icon: GitBranch, note: "Alternative executions", color: "blue" }].map(stat => <div className="stat" key={stat.name}><span className="stat-label">{stat.name}<stat.icon size={15} /></span><strong className={stat.color || ""}>{stat.value}</strong><small>{stat.note}</small></div>)}
    </div>
    {latestFailure && <section className="recent-investigation" aria-label="Latest failed execution"><div><h3>{runTitle(latestFailure)}</h3><p className="investigation-heading"><CircleAlert size={15} aria-hidden="true" />Latest failed execution</p><p className="mono muted">{shortId(latestFailure.runId)} <span className="footer-separator">/</span>{latestFailure.steps.length} recorded steps</p><Link className="text-link" href={`/trace/${latestFailure.runId}`}>Inspect trace <ArrowRight size={15} aria-hidden="true" /></Link></div><div className="mini-pipeline" aria-label="Latest execution steps">{latestFailure.steps.map(step => { const failedStep = step.status === "error" || step.status === "failed"; return <div className={`mini-node ${failedStep ? "error" : ""}`} key={step.stepId}><span>{String(step.stepId).padStart(2, "0")}</span><i aria-hidden="true">{failedStep ? <CircleAlert size={13} /> : <Check size={13} />}</i><small>{step.stepType}<span className="sr-only">: {step.status}</span></small></div>; })}</div></section>}
    <div className="section-heading"><h2>Run history <span className="count">{runs.length}</span></h2><div className="heading-actions"><span className="quiet-label"><Clock3 size={13} />{sort === "oldest" ? "Oldest recorded first" : sort === "duration" ? "Longest duration first" : sort === "failed" ? "Failed executions first" : "Latest recorded first"}</span>{filtered.length > 0 && <DownloadButton value={filtered} name="execution-runs.json" />}</div></div>
    <div className="table-toolbar"><div className="filter-tabs" role="group" aria-label="Run outcome">{[["all", "All runs", filterCounts.all], ["failed", "Failed", filterCounts.failed], ["success", "Successful", filterCounts.success], ["replays", "Replays", filterCounts.replays]].map(([value, label, count]) => <button aria-pressed={filter === value} className={filter === value ? "active" : ""} key={value} onClick={() => { setFilter(String(value)); setPage(1); }}>{label}<span>{count}</span></button>)}</div><div className="table-tools"><label className="search-field"><Search size={15} /><input aria-label="Search runs" placeholder="Search runs..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></label><label className="sort-field"><select aria-label="Filter workflow" style={{ width: 150 }} value={workflowFilter} onChange={e => { setWorkflowFilter(e.target.value); setPage(1); }}><option value="all">All workflows</option><option value="documents">Documents</option><option value="arithmetic">Arithmetic</option><option value="examples">Examples</option></select></label><label className="sort-field"><SlidersHorizontal size={15} /><select aria-label="Sort runs" value={sort} onChange={e => setSort(e.target.value)}><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="duration">Longest</option><option value="failed">Failed first</option></select></label></div></div>
    {error && <ErrorNotice message={error} retry={refresh} />}
    {loading ? <Loading /> : <><div className="table-scroll run-history-scroll" role="region" aria-label="Execution history; scroll horizontally for timing and inspection" tabIndex={0}><table className="runs-table"><thead><tr><th>Execution <ArrowDown size={11} /></th><th>Agent</th><th>Outcome</th><th>Steps</th><th>Duration</th><th>Recorded</th><th><span className="sr-only">Inspect</span></th></tr></thead><tbody>{filtered.slice((currentPage - 1) * 8, currentPage * 8).map(run => <tr key={run.runId} className={run.outcome === "failed" ? "failed-execution" : ""}><td><Link className="run-link" href={`/trace/${run.runId}`}><span className={`run-glyph ${run.parentRunId ? "branch" : ""}`}>{run.parentRunId ? <GitBranch size={16} /> : <Layers3 size={16} />}</span><span><strong>{runTitle(run)}</strong><small className="mono">{shortId(run.runId)}{run.parentRunId && <span className="inline-label">replay</span>}</small></span></Link></td><td><span className="agent-cell"><span className="agent-dot" />{run.agentName === "local-arithmetic-agent" ? "Arithmetic agent" : run.agentName === "local-document-agent" ? "Document agent" : run.agentName}</span><small className="cell-subtext">{run.source === "legacy-fixture" ? "Legacy fixture" : "Controlled workflow"}</small></td><td><Status value={run.outcome} /></td><td className="mono muted">{String(run.steps.length).padStart(2, "0")}</td><td className="mono muted">{duration(run.durationMs)}</td><td className="date-cell">{new Date(run.timestamp).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}<small>{new Date(run.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</small></td><td><Link className="icon-button" title="Inspect execution" aria-label={`Inspect run ${shortId(run.runId)}`} href={`/trace/${run.runId}`}><ArrowUpRight size={16} /></Link></td></tr>)}</tbody></table></div>{!error && filtered.length === 0 && <div className="empty-state"><Search size={23} /><h3>{runs.length === 0 ? "No executions yet" : "No matching executions"}</h3>{runs.length === 0 ? <button className="button primary" onClick={() => { setCreateError(""); dialog.current?.showModal(); }}><Plus size={16} />New run</button> : <button className="button" onClick={resetFilters}>Reset filters</button>}</div>}<div className="table-footer"><span>{filtered.length ? `${(currentPage - 1) * 8 + 1}-${Math.min(currentPage * 8, filtered.length)}` : "0"} of {filtered.length} executions</span><div><span>Page {currentPage} of {pages}</span><button className="icon-button" title="Previous page" aria-label="Previous page" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={16} /></button><button className="icon-button" title="Next page" aria-label="Next page" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}><ChevronRight size={16} /></button></div></div></>}
    <NewRunDialog dialog={dialog} workflow={workflow} setWorkflow={setWorkflow} sourceMode={sourceMode} setSourceMode={setSourceMode} creating={creating} error={createError} onSubmit={createRun} />
  </div>;
}
