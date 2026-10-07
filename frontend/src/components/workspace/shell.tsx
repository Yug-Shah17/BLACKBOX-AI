"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Activity, ArrowUpRight, Box, ChevronDown, ChevronRight, Database, FlaskConical, Layers3, Menu, Settings2, X } from "lucide-react";
import { api } from "@/lib/api";
const navigation = [{ href: "/runs", label: "Execution runs", icon: Layers3 }, { href: "/evaluation", label: "Evaluation", icon: FlaskConical }, { href: "/datasets", label: "Data & exports", icon: Database }];
export default function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(); const [connected, setConnected] = useState<boolean | null>(null); const [open, setOpen] = useState(false);
  const sidebar = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const controls = () => Array.from(sidebar.current?.querySelectorAll<HTMLElement>('a, button:not(:disabled)') || []).filter(element => element.getClientRects().length > 0);
    controls()[0]?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab") return;
      const items = controls(); const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const handleResize = () => { if (window.innerWidth > 760) setOpen(false); };
    document.addEventListener("keydown", handleKey);
    window.addEventListener("resize", handleResize);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", handleKey); window.removeEventListener("resize", handleResize); document.querySelector<HTMLButtonElement>(".mobile-menu")?.focus(); };
  }, [open]);
  const section = pathname.startsWith("/trace/") ? "Trace inspection" : navigation.find(n => pathname.startsWith(n.href))?.label || (pathname === "/settings" ? "Workspace settings" : "Execution runs");
  useEffect(() => {
    if (pathname === "/") return;
    const controller = new AbortController();
    const check = () => api("/health", undefined, controller.signal).then(() => setConnected(true)).catch(() => { if (!controller.signal.aborted) setConnected(false); });
    check(); const interval = setInterval(check, 30000);
    const frame = requestAnimationFrame(() => {
      let theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
      let density = document.documentElement.dataset.density === "compact" ? "compact" : "comfortable";
      try {
        theme = localStorage.getItem("blackbox-theme") === "dark" ? "dark" : "light";
        density = localStorage.getItem("blackbox-density") === "compact" ? "compact" : "comfortable";
      } catch { /* Browser storage is optional; retain usable defaults. */ }
      document.documentElement.dataset.theme = theme; document.documentElement.dataset.density = density;
    });
    return () => { controller.abort(); clearInterval(interval); cancelAnimationFrame(frame); };
  }, [pathname]);
  if (pathname === "/") return <>{children}</>;
  return <div className="app-workspace"><a className="skip-link" href="#workspace-main">Skip to workspace</a>
    {open && <button className="mobile-shade" aria-label="Close navigation" onClick={() => setOpen(false)} />}
    <aside ref={sidebar} id="workspace-navigation" aria-label="Workspace navigation" className={`sidebar ${open ? "open" : ""}`}>
      <Link href="/" className="brand" aria-label="Black Box home" onClick={() => setOpen(false)}><span className="brand-mark"><Box size={21} strokeWidth={1.8} /></span><span>blackbox<span className="brand-period">.</span></span></Link>
      <Link href="/settings" className="workspace-picker" onClick={() => setOpen(false)}><span className="workspace-avatar">Y</span><span>Personal workspace<small>Local project</small></span><ChevronDown size={14} /></Link>
      <div className="nav-caption">WORKSPACE</div><nav aria-label="Main navigation">{navigation.map(item => <Link key={item.href} href={item.href} aria-current={(pathname.startsWith(item.href) || (item.href === "/runs" && (pathname === "/" || pathname.startsWith("/trace/")))) ? "page" : undefined} onClick={() => setOpen(false)} className={`nav-item ${(pathname.startsWith(item.href) || (item.href === "/runs" && (pathname === "/" || pathname.startsWith("/trace/")))) ? "active" : ""}`}><item.icon size={17} /><span>{item.label}</span></Link>)}</nav>
      <div className="sidebar-divider" /><div className="nav-caption">ENVIRONMENT</div><div className="environment"><span className={`connection-dot ${connected ? "connected" : ""}`} />Local development<span className="env-count">01</span></div>
      <div className="sidebar-bottom"><div className="model-label"><Activity size={15} /><span>Execution inspection<small>Recorded workflows</small></span></div><Link href="/settings" aria-current={pathname === "/settings" ? "page" : undefined} className={`nav-item ${pathname === "/settings" ? "active" : ""}`} onClick={() => setOpen(false)}><Settings2 size={17} />Workspace settings</Link><div className="profile"><span className="profile-avatar">YS</span><span>Yug Shah<small>Independent developer</small></span></div></div>
      <button className="mobile-close icon-button" aria-label="Close navigation" onClick={() => setOpen(false)}><X size={18} /></button>
    </aside><div className="workspace-body"><header className="topbar"><button className="mobile-menu icon-button" aria-expanded={open} aria-controls="workspace-navigation" aria-label="Open navigation" onClick={() => setOpen(true)}><Menu size={19} /></button><div className="breadcrumbs"><Box size={14} /><span>Workspace</span><ChevronRight size={12} /><strong>{section}</strong></div><div className="topbar-end"><span className={`api-state ${connected === false ? "offline" : ""}`}><span className={`connection-dot ${connected ? "connected" : ""}`} />{connected === null ? "Connecting" : connected ? "API connected" : "API offline"}</span><a className="icon-button api-link" href="/api/blackbox/openapi.json" target="_blank" rel="noreferrer" title="Open API schema" aria-label="Open API schema"><ArrowUpRight size={17} /></a></div></header><main id="workspace-main">{children}</main><footer className="workspace-footer"><span>Black Box <span className="footer-separator">/</span>Agent observability</span><nav aria-label="Developer links"><span>Yug Shah</span><a href="https://github.com/Yug-Shah17" target="_blank" rel="noopener noreferrer">GitHub<ArrowUpRight size={12} /></a><a href="https://www.linkedin.com/in/yug-shah-lnkdn/" target="_blank" rel="noopener noreferrer">LinkedIn<ArrowUpRight size={12} /></a></nav></footer></div></div>;
}
