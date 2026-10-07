"use client";
import { AlertCircle, Check, CircleDashed, Download, X } from "lucide-react";
import { exportJson } from "@/lib/api";
export function Status({ value, label }: { value: string; label?: string }) {
  const good = value === "success"; const bad = value === "failed" || value === "error";
  const Icon = good ? Check : bad ? X : CircleDashed;
  return <span className={`status ${good ? "success" : bad ? "failed" : "neutral"}`}><Icon size={12} />{label || (good ? "Successful" : bad ? "Failed" : value)}</span>;
}
export function ErrorNotice({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="error-notice" role="alert"><AlertCircle size={18} /><span>{message}</span>{retry && <button type="button" className="button small" onClick={retry}>Try again</button>}</div>;
}
export function Loading() {
  return <div className="record-skeleton" role="status" aria-label="Loading records">
    <span className="sr-only">Loading records</span>
    <div className="skeleton-header" aria-hidden="true"><span /><span /></div>
    {[0, 1, 2, 3, 4].map(row => <div className="skeleton-row" key={row} aria-hidden="true"><span /><span /><span /></div>)}
  </div>;
}
export function JsonBlock({ value }: { value: unknown }) { return <pre className="json-block"><code>{JSON.stringify(value, null, 2)}</code></pre>; }
export function DownloadButton({ value, name, label = "Download JSON" }: { value: unknown; name: string; label?: string }) { return <button type="button" className="icon-button" title={label} aria-label={label} onClick={() => exportJson(value, name)}><Download size={16} /></button>; }
