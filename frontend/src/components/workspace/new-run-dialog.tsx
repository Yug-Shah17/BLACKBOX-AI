"use client";

import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { ArrowRight, FileUp, LoaderCircle, X } from "lucide-react";
import { api, type DemoDocument, type DocumentScenario } from "@/lib/api";
import { readDocuments } from "@/lib/document-upload";
import { ErrorNotice } from "./primitives";

export function NewRunDialog({ dialog, workflow, setWorkflow, sourceMode, setSourceMode, creating, error, onSubmit }: {
  dialog: RefObject<HTMLDialogElement | null>; workflow: string; setWorkflow: (value: string) => void;
  creating: boolean; error: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  sourceMode: string; setSourceMode: (value: string) => void;
}) {
  const documents = workflow === "documents";
  const [scenarios, setScenarios] = useState<DocumentScenario[]>([]);
  const [scenarioId, setScenarioId] = useState("registration");
  const [uploadQuestion, setUploadQuestion] = useState<string | null>(null);
  const [demoQuestion, setDemoQuestion] = useState<string | null>(null);
  const [scenarioError, setScenarioError] = useState("");
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [uploaded, setUploaded] = useState<DemoDocument[]>([]);
  const [uploadError, setUploadError] = useState("");
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [answeringMode, setAnsweringMode] = useState("gemini");
  const [externalConsent, setExternalConsent] = useState(false);
  const uploadAttempt = useRef(0);
  const uploadRequest = useRef<AbortController | null>(null);
  useEffect(() => () => uploadRequest.current?.abort(), []);
  function cancelUpload() {
    uploadRequest.current?.abort(); uploadAttempt.current += 1; setReading(false);
  }
  const uploading = sourceMode === "upload";
  const question = uploading ? uploadQuestion : demoQuestion;
  const setQuestion = uploading ? setUploadQuestion : setDemoQuestion;
  const ready = uploading ? uploaded.length > 0 && !reading : Boolean(scenarios.length);
  const scenario = scenarios.find(item => item.id === scenarioId) ?? scenarios[0];
  async function importFiles(files: File[]) {
    if (!files.length || creating || reading) return;
    const attempt = ++uploadAttempt.current;
    uploadRequest.current?.abort();
    const controller = new AbortController(); uploadRequest.current = controller;
    setReading(true); setUploadError("");
    try { const value = await readDocuments(files, controller.signal); if (attempt === uploadAttempt.current) { setUploaded(value); setExternalConsent(false); } }
    catch (error) { if (attempt === uploadAttempt.current) setUploadError(`${error instanceof Error ? error.message : "Could not read documents."}${uploaded.length ? " Previous documents were kept." : ""}`); }
    finally { if (attempt === uploadAttempt.current) setReading(false); }
  }
  useEffect(() => {
    const controller = new AbortController();
    api<DocumentScenario[]>("/document-scenarios", undefined, controller.signal).then(value => {
      if (!controller.signal.aborted) { setScenarios(value); setScenarioError(""); }
    }).catch(error => { if (!controller.signal.aborted) setScenarioError(error.message); });
    return () => controller.abort();
  }, [catalogAttempt]);
  return <dialog ref={dialog} className="create-dialog" onCancel={event => { if (creating) event.preventDefault(); }} onClose={() => { cancelUpload(); setExternalConsent(false); }}><form onSubmit={onSubmit}>
    <div className="dialog-heading"><div><div className="eyebrow">LOCAL EXECUTION</div><h2>New agent run</h2></div>
      <button type="button" className="icon-button" aria-label="Close new run" disabled={creating} onClick={() => dialog.current?.close()}><X size={18} /></button></div>
    <label>Workflow<select aria-label="Workflow" value={workflow} disabled={creating} onChange={e => setWorkflow(e.target.value)}>
      <option value="documents">Document question answering</option><option value="arithmetic">Arithmetic</option>
    </select></label>
    {documents ? <>
      <div className="form-row"><label>Answering mode<select name="answeringMode" aria-label="Answering mode" value={answeringMode} disabled={creating} onChange={e => { setAnsweringMode(e.target.value); setExternalConsent(false); }}>
        <option value="gemini">Gemini document answers</option><option value="local">Local extracts and word counts</option>
      </select></label>
      <label>Document source<select aria-label="Document source" value={sourceMode} disabled={creating || reading} onChange={e => { setSourceMode(e.target.value); setExternalConsent(false); }}>
        <option value="demo">Fictional demo documents</option><option value="upload">Upload documents</option>
      </select></label></div>
      {uploading ? <>
        <label className={`document-drop ${dragging ? "dragging" : ""}`} onDragOver={e => { e.preventDefault(); if (!creating && !reading) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); void importFiles(Array.from(e.dataTransfer.files)); }}><FileUp size={28} aria-hidden="true" /><span>Upload documents</span><small>TXT / MD / PDF / DOCX</small><input aria-label="Upload documents" type="file" accept=".txt,.md,.pdf,.docx" multiple disabled={creating || reading} onChange={e => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (!files.length) return;
          void importFiles(files);
        }} /></label>
        {reading && <div className="upload-heading"><p role="status">Reading documents...</p><button type="button" className="icon-button" aria-label="Cancel upload" title="Cancel upload" onClick={cancelUpload}><X size={16} /></button></div>}
        {uploadError && <ErrorNotice message={uploadError} />}
        {uploaded.filter(document => document.current).length > 1 && <label>First current source<select aria-label="First current source" value={uploaded.find(document => document.current)?.documentId ?? ""} disabled={creating || reading} onChange={event => {
          const selectedId = event.target.value;
          setUploaded(items => { const selected = items.find(item => item.documentId === selectedId); return selected ? [selected, ...items.filter(item => item.documentId !== selectedId)] : items; });
          setExternalConsent(false);
        }}>{uploaded.filter(document => document.current).map(document => <option key={document.documentId} value={document.documentId}>{document.title}</option>)}</select></label>}
        {uploaded.map((document, index) => <section key={document.documentId}>
          <div className="upload-heading"><h3>{document.title}</h3><button type="button" className="icon-button" aria-label={`Remove ${document.title}`} title={`Remove ${document.title}`} disabled={creating} onClick={() => { setUploaded(items => items.filter((_, i) => i !== index)); setExternalConsent(false); }}><X size={16} /></button></div>
          <details><summary>Source details ({document.text.length.toLocaleString()} characters)</summary>
          <label>Topic<input aria-label={`Topic for ${document.title}`} value={document.topic} required maxLength={200} disabled={creating} onChange={e => setUploaded(items => items.map((item, i) => i === index ? { ...item, topic: e.target.value } : item))} /></label>
          <label className="upload-current"><input type="checkbox" aria-label={`Current source: ${document.title}`} checked={document.current} disabled={creating} onChange={e => { setUploaded(items => items.map((item, i) => i === index ? { ...item, current: e.target.checked } : item)); setExternalConsent(false); }} /> Current source</label>
          <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxHeight: 200, overflowY: "auto" }}>{document.text}</p></details>
        </section>)}
      </> : <label>Document set<select aria-label="Document set" value={scenario?.id ?? ""} disabled={creating || !scenario} onChange={e => { setScenarioId(e.target.value); setQuestion(null); setExternalConsent(false); }}>
        {!scenario && <option value="">Loading document sets...</option>}
        {scenarios.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>}
      <label>Question<textarea name="question" aria-label="Question" rows={2} required maxLength={1000} value={question ?? (uploading ? "" : scenario?.question ?? "")} disabled={creating || !ready} onChange={e => setQuestion(e.target.value)} /></label>
      <input type="hidden" name="documents" value={JSON.stringify(uploading ? uploaded : scenario?.documents ?? [])} />
      {answeringMode === "gemini" && <>
        <p className="quiet-label">Answers use the first current document. Google processes its text; free-tier data may be used to improve Google products. Use non-sensitive documents.</p>
        <label className="upload-current"><input type="checkbox" name="allowExternalProcessing" checked={externalConsent} disabled={creating} required onChange={e => setExternalConsent(e.target.checked)} /> I consent to sending the selected document and question to Google.</label>
      </>}
      {!uploading && scenario && <details><summary>Fictional source documents ({scenario.documents.length})</summary>
        {scenario.documents.map(document => <section key={document.documentId}><h3>{document.title} <span className="status neutral">{document.current ? "Current" : "Archived"}</span></h3><p>{document.text}</p><small className="mono">{document.documentId}</small></section>)}
      </details>}
      {!uploading && scenarioError && <ErrorNotice message={scenarioError} retry={() => { setScenarioError(""); setCatalogAttempt(attempt => attempt + 1); }} />}
    </> :
      <div className="form-row"><label>First value<input name="a" type="number" required defaultValue={12} min={-1000000} max={1000000} /></label>
        <label>Second value<input name="b" type="number" required defaultValue={30} min={-1000000} max={1000000} /></label></div>}
    <details className="simulation-options"><summary>Failure simulation (optional)</summary>
    <label>Execution scenario<select name="fault" key={`${workflow}-${sourceMode}`} defaultValue={documents ? "normal" : "calculation_error"} disabled={creating}>
      <option value="normal">Successful execution</option>
      {documents ? <><option value="missing_retrieval">Missing retrieval</option><option value="wrong_source">Wrong source</option>
        <option value="unsupported_answer">Unsupported answer</option><option value="incorrect_citation">Incorrect citation</option></> :
        <><option value="calculation_error">Incorrect calculation</option><option value="tool_error">Retrieval tool error</option>
          <option value="invalid_selection">Invalid document selection</option><option value="answer_mismatch">Answer mismatch</option></>}
    </select></label>
    </details>
    {error && <ErrorNotice message={error} />}
    <div className="dialog-footer"><span className="quiet-label">{documents ? "Document agent / 4 steps" : "Arithmetic agent / 5 steps"}</span>
      <button className="button primary" disabled={creating || (documents && (!ready || (answeringMode === "gemini" && !externalConsent)))}>{creating ? <LoaderCircle className="spin" size={16} /> : <ArrowRight size={16} />}Execute run</button></div>
  </form></dialog>;
}
