"use client";

import { useEffect, useState } from "react";
import { api, type DocumentMetrics, percent } from "@/lib/api";
import { DownloadButton, ErrorNotice, Status } from "./primitives";

export function DocumentEvaluation() {
  const [report, setReport] = useState<DocumentMetrics | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api<DocumentMetrics>("/document-evaluation", undefined, controller.signal).then(value => {
      if (!controller.signal.aborted) setReport(value);
    }).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [attempt]);
  return <section className="measurement-section">
    <div className="section-heading"><h2>Document scenario checks</h2>{report && <DownloadButton value={report} name="document-evaluation.json" />}</div>
    <p className="quiet-label">Rule-based diagnosis / Fictional documents / Not a learned model</p>
    {error && <ErrorNotice message={error} retry={() => { setError(""); setAttempt(value => value + 1); }} />}
    {!report && !error && <p className="quiet-label" role="status">Loading document checks...</p>}
    {report && <>
      <div className="stats-band">
        {[{ title: "Failure cases", value: String(report.caseCount), note: "Three sets / four injected faults" },
          { title: "Correct step", value: percent(report.top1Localization), note: "Controlled rule localization" },
          { title: "Corrected replays", value: percent(report.fixtureCorrectionSuccessRate), note: "Known fixture corrections" },
          { title: "Wrong fixes fail", value: percent(report.wrongCorrectionFailureRate), note: "Validator remains active" }].map(item =>
          <div className="stat" key={item.title}><span className="stat-label">{item.title}</span><strong>{item.value}</strong><small>{item.note}</small></div>)}
      </div>
      <div className="table-scroll"><table className="runs-table"><thead><tr><th>Document set</th><th>Injected fault</th><th>Expected step</th><th>Diagnosed step</th><th>Replay</th></tr></thead>
        <tbody>{report.cases.map(item => <tr key={`${item.scenario}-${item.fault}`}><td>{item.scenario}</td><td>{item.fault.replaceAll("_", " ")}</td><td>{item.expectedStep}</td><td>{item.predictedStep}</td><td><Status value={item.correctedOutcome} /></td></tr>)}</tbody></table></div>
      <p className="muted">{report.limitations}</p>
    </>}
  </section>;
}
