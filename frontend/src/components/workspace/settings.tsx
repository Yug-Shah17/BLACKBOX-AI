"use client";
import { useEffect, useState } from "react";
import { Check, ExternalLink, Moon, Sun } from "lucide-react";

export default function SettingsWorkspace() {
  const [theme, setTheme] = useState("light"); const [density, setDensity] = useState("comfortable");
  const [savedLocally, setSavedLocally] = useState(true);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try { setTheme(localStorage.getItem("blackbox-theme") === "dark" ? "dark" : "light"); setDensity(localStorage.getItem("blackbox-density") === "compact" ? "compact" : "comfortable"); }
      catch {
        setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
        setDensity(document.documentElement.dataset.density === "compact" ? "compact" : "comfortable");
        setSavedLocally(false);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  function changeTheme(value: string) {
    setTheme(value); document.documentElement.setAttribute("data-theme", value);
    try { localStorage.setItem("blackbox-theme", value); setSavedLocally(true); } catch { setSavedLocally(false); }
  }
  function changeDensity(value: string) {
    setDensity(value); document.documentElement.setAttribute("data-density", value);
    try { localStorage.setItem("blackbox-density", value); setSavedLocally(true); } catch { setSavedLocally(false); }
  }
  return <div className="page settings-page"><div className="page-heading"><div><div className="eyebrow">PREFERENCES</div><h1>Workspace settings</h1><p className="page-subtitle">Yug Shah <span className="subtle-dot" /> This browser</p></div><span className="quiet-label"><Check size={13} />{savedLocally ? "Saved locally" : "Session only"}</span></div><section className="settings-section"><h2>Appearance</h2><div className="setting-row"><div><h3>Color theme</h3><p>Workspace appearance</p></div><div className="segmented" aria-label="Color theme"><button aria-pressed={theme === "light"} onClick={() => changeTheme("light")} className={theme === "light" ? "active" : ""}><Sun size={14} />Light</button><button aria-pressed={theme === "dark"} onClick={() => changeTheme("dark")} className={theme === "dark" ? "active" : ""}><Moon size={14} />Dark</button></div></div><div className="setting-row"><div><h3>Table density</h3><p>Execution record spacing</p></div><div className="segmented" aria-label="Table density">{["comfortable", "compact"].map(value => <button key={value} aria-pressed={density === value} className={density === value ? "active" : ""} onClick={() => changeDensity(value)}>{value === "compact" ? "Compact" : "Comfortable"}</button>)}</div></div></section><section className="settings-section"><h2>Project environment</h2><div className="setting-row"><div><h3>Backend</h3><p className="mono">/api/blackbox</p></div><a className="button" href="/api/blackbox/openapi.json" target="_blank" rel="noreferrer"><ExternalLink size={14} />API schema</a></div><div className="setting-row"><div><h3>Execution scope</h3><p>Controlled arithmetic and document workflows</p></div><span className="status neutral">Local development</span></div><div className="setting-row"><div><h3>Arithmetic model</h3><p className="mono">demo-step-ranker-v1</p></div><span className="status neutral">Learned ranker</span></div><div className="setting-row"><div><h3>Document diagnosis</h3><p>Recorded source and citation checks</p></div><span className="status neutral">Rule-based</span></div></section></div>;
}
