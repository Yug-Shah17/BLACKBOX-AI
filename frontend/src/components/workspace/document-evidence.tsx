"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { exportFile } from "@/lib/api";
import type { DocumentContext, RecordedRun } from "@/lib/api";
import { DownloadButton, ErrorNotice, Status } from "./primitives";

export function DocumentEvidence({ run, context, error }: {
  run: RecordedRun; context: DocumentContext | null; error: string;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sources = useRef<HTMLDetailsElement>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const generation = run.steps.find(step => step.stepType === "generation");
  const output = generation?.outputData;
  const evidence = generation?.inputData?.answerEvidence as { quotes?: unknown[]; supported?: boolean } | undefined;
  const providerError = generation?.inputData?.providerError as { message?: string } | undefined;
  const citation = typeof output?.citation === "string" ? output.citation : null;
  const source = context?.documents.find(document => document.documentId === citation);
  const answer = typeof output?.answer === "string" ? output.answer : null;
  function inspectSource() {
    if (!sources.current) return;
    sources.current.open = true;
    const sourceElement = sources.current.querySelector<HTMLElement>('[data-cited="true"]');
    sourceElement?.scrollIntoView({ block: "center" });
    sourceElement?.focus({ preventScroll: true });
  }
  async function copyAnswer() {
    if (answer === null) return;
    try { await navigator.clipboard.writeText(answer); setCopyState("copied"); }
    catch { setCopyState("failed"); }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopyState("idle"), 3000);
  }
  return <section className="document-evidence" aria-label="Recorded document evidence">
    <div className="section-heading"><h2>Recorded answer</h2><div className="heading-actions">{answer !== null && <><button type="button" className="icon-button" title="Copy answer" aria-label="Copy answer" onClick={() => void copyAnswer()}>{copyState === "copied" ? <Check size={16} /> : <Copy size={16} />}</button><button type="button" className="icon-button" title="Download answer" aria-label="Download answer" onClick={() => exportFile(new Blob([answer], { type: "text/plain;charset=utf-8" }), `${run.runId}-answer.txt`)}><Download size={16} /></button></>}<Status value={run.outcome} /></div></div>
    {copyState !== "idle" && <p className="quiet-label" role="status">{copyState === "copied" ? "Answer copied." : "Clipboard unavailable. Download the answer instead."}</p>}
    <div className="answer-evidence-layout"><div className="answer-result"><p className="recorded-answer">{typeof output?.answer === "string" ? output.answer : "No answer recorded"}</p></div><div className="answer-support">
    <p className="answer-citation"><span>Cited source</span>{source ? <button type="button" className="citation-link" onClick={inspectSource}>{source.title}</button> : <strong>{citation ?? "None"}</strong>}</p>
    {providerError?.message && <ErrorNotice message={providerError.message} />}
    {evidence?.supported === false && <p className="quiet-label">No supported answer found in the selected document.</p>}
    {!!evidence?.quotes?.length && <h3 className="evidence-heading">Supporting passages</h3>}
    {evidence?.quotes?.map((quote, index) => typeof quote === "string" && <blockquote key={index}>{quote}</blockquote>)}
    {typeof generation?.inputData?.model === "string" && <p className="quiet-label">Evidence checks verify source quotes and citation, not every factual claim.</p>}
    {error && <ErrorNotice message={error} />}
    </div></div>
    {context && <details ref={sources}><summary>Source documents ({context.documents.length})</summary>
      <div className="section-heading execution-sources"><h3>Execution sources</h3><DownloadButton value={context} name={`${run.runId}-sources.json`} /></div>
      {context.documents.map(document => <article className="source-record" key={document.documentId} data-cited={document.documentId === citation} tabIndex={-1}>
        <h3>{document.title} <span className="status neutral">{document.current ? "Current" : "Archived"}</span></h3>
        <p>{document.text}</p><p className="mono muted">{document.documentId}{document.documentId === citation ? " / cited" : ""}</p>
      </article>)}
    </details>}
  </section>;
}
