"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, Box, Check, FileText, GitBranch, Pause, Play, RotateCcw, ScanLine, ShieldCheck } from "lucide-react";

const stages = [
  { name: "Retrieve", icon: FileText, title: "Start with the source.", detail: "A fictional returns policy is retrieved: returns are accepted within 30 days.", value: "Returns accepted within 30 days.", state: "Source retrieved" },
  { name: "Select", icon: ScanLine, title: "Keep the evidence in view.", detail: "The current policy is selected. Its identity follows the answer through the execution.", value: 'documentId: "policy-current"', state: "Current source selected" },
  { name: "Answer", icon: Box, title: "An answer is not the whole story.", detail: "This demonstration intentionally inserts an unsupported answer so there is a failure to investigate.", value: "Returns accepted forever.", state: "Injected incorrect answer" },
  { name: "Check", icon: ShieldCheck, title: "See where it went wrong.", detail: "The recorded answer does not pass the source evidence check. Generation is the likely failure origin.", value: "Generation / source evidence mismatch", state: "Evidence check failed" },
  { name: "Replay", icon: GitBranch, title: "Test a different outcome.", detail: "Replace the answer with a literal source extract. Earlier steps are reused and the original stays unchanged.", value: "Returns accepted within 30 days.", state: "Corrected branch passed" },
];

export default function HomePage() {
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    const node = root.current;
    if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        entry.target.animate([{ transform: "translateY(30px)", opacity: .65 }, { transform: "translateY(0)", opacity: 1 }], { duration: 750, easing: "cubic-bezier(.16,1,.3,1)" });
        observer.unobserve(entry.target);
      }
    }, { threshold: .12 });
    node.querySelectorAll(".product-heading,.execution-scene,.workflow-list article,.home-final").forEach(element => observer.observe(element));
    let frame = 0;
    const update = () => {
      frame = 0;
      const progress = Math.min(window.scrollY / Math.max(window.innerHeight, 1), 1);
      node.style.setProperty("--hero-shift", `${progress * 65}px`);
      node.style.setProperty("--hero-scale", `${1 + progress * .055}`);
      node.style.setProperty("--scroll-progress", `${window.scrollY / Math.max(document.documentElement.scrollHeight - window.innerHeight, 1)}`);
    };
    const scroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update(); window.addEventListener("scroll", scroll, { passive: true });
    return () => { observer.disconnect(); window.removeEventListener("scroll", scroll); cancelAnimationFrame(frame); };
  }, []);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!playing || reduced.matches || active === stages.length - 1) return;
    let timer: number | undefined;
    const scene = root.current?.querySelector(".execution-scene");
    if (!scene) return;
    const observer = new IntersectionObserver(entries => {
      window.clearTimeout(timer);
      if (entries[0].isIntersecting) timer = window.setTimeout(() => setActive(previous => Math.min(previous + 1, stages.length - 1)), 2200);
    }, { threshold: .5 });
    observer.observe(scene);
    return () => { observer.disconnect(); window.clearTimeout(timer); };
  }, [playing, active]);
  const stage = stages[active];
  const demoRunning = playing && active < stages.length - 1;
  return <div className="home-page" ref={root}>
    <a className="skip-link" href="#home-main">Skip to content</a>
    <header className="home-header"><Link href="/" className="home-brand" aria-label="Black Box home"><Box size={25} />blackbox<span>.</span></Link>
      <nav aria-label="Homepage navigation"><a href="#product">The product</a><a href="#workflow">How it works</a><Link href="/runs" className="home-nav-action">Open workspace<ArrowUpRight size={16} /></Link></nav>
    </header>
    <main id="home-main">
      <section className="home-hero" aria-labelledby="home-title">
        <Image className="hero-art" src="/blackbox-forest.png" alt="Conceptual Black Box flight recorder opened into layers of source evidence and a forest-green answer layer" fill priority sizes="100vw" />
        <div className="hero-intro"><h1 id="home-title">Black Box<span>.</span></h1><p className="hero-statement">See beyond<br />the answer.</p><p className="hero-description">Document answers, their evidence, and the moment things went wrong. Open the execution. Replay a better outcome.</p><div className="hero-actions"><Link className="home-action ink" href="/runs">Open workspace<ArrowUpRight size={20} /></Link><a className="hero-secondary" href="#workflow">Explore the execution<ArrowDown size={17} /></a></div></div>
        <a className="hero-scroll" href="#product">Inside Black Box<ArrowDown size={17} /></a>
      </section>
      <section id="workflow" className="home-execution"><div className="execution-intro"><h2>Every answer<br />leaves a trace.</h2><p>Follow a fictional document execution from source to correction. The failure is deliberately injected; no API request is made.</p></div>
        <div className="execution-scene" aria-label="Interactive fictional execution demonstration">
          <div className="scene-heading"><span>DOCUMENT EXECUTION / FICTIONAL DEMO</span><div><button type="button" title="Restart demonstration" aria-label="Restart demonstration" onClick={() => { setActive(0); setPlaying(true); }}><RotateCcw size={17} /></button><button type="button" title={demoRunning ? "Pause demonstration" : "Play demonstration"} aria-label={demoRunning ? "Pause demonstration" : "Play demonstration"} onClick={() => { if (active === stages.length - 1) { setActive(0); setPlaying(true); } else setPlaying(value => !value); }}>{demoRunning ? <Pause size={17} /> : <Play size={17} />}</button></div></div>
          <div className="scene-track">{stages.map((item, index) => <button key={item.name} type="button" className={`scene-stage ${index <= active ? "reached" : ""} ${index === active ? "current" : ""} ${index === 3 ? "fault" : ""} ${index === 4 ? "branch" : ""}`} aria-pressed={index === active} onClick={() => { setActive(index); setPlaying(false); }}><span className="stage-symbol"><item.icon size={25} /></span><span>{item.name}</span>{index < active && <Check size={13} className="stage-check" />}</button>)}</div>
          <div className={`scene-detail ${active === 3 ? "fault-detail" : active === 4 ? "branch-detail" : ""}`}><div key={active} className="scene-detail-copy"><strong>{stage.title}</strong><p>{stage.detail}</p></div><div className="scene-observation"><span>{stage.state}</span><code>{stage.value}</code></div></div>
        </div>
      </section>
      <section id="product" className="home-product"><div className="product-heading"><h2>More than an answer.<br />The evidence behind it.</h2><p>Upload a document. Ask your question. Then look inside the execution, from the selected source to the answer and its checks.</p></div>
        <div className="product-image"><Image src="/trace-preview-final.png" alt="Black Box showing a recorded document answer, cited source, evidence quote and execution steps" width={1440} height={900} sizes="(max-width: 760px) 100vw, 1200px" /></div>
        <div className="product-caption"><span><Check size={16} />Actual interface. Fictional registration document.</span><span>TXT / MD / PDF / DOCX</span></div>
      </section>
      <section className="home-workflow"><h2>Understand it.<br />Then improve it.</h2><div className="workflow-list">
        <article><FileText size={26} /><h3>Ask your document.</h3><p>Gemini answers from the selected source with supporting quotes. Explicit word counts stay local.</p></article>
        <article><ScanLine size={26} /><h3>Inspect each step.</h3><p>See the inputs, outputs, source selection and evidence checks recorded along the way.</p></article>
        <article><GitBranch size={26} /><h3>Replay a correction.</h3><p>Replace a step output, reuse the earlier execution and compare the new branch with the untouched original.</p></article>
      </div><p className="home-scope">A focused document workflow, not a general-purpose debugger. Evidence checks do not guarantee every factual interpretation.</p></section>
      <section className="home-final"><h2>Open the<br />black box.</h2><div><p>Bring a non-sensitive document,<br />or start with a fictional example.</p><Link href="/runs" className="home-action ink">Open workspace<ArrowRight size={20} /></Link></div></section>
    </main>
    <footer className="home-footer"><Link href="/" className="home-brand"><Box size={23} />blackbox<span>.</span></Link><p>Document answers. Recorded evidence. Checkpoint replay.</p><nav aria-label="Footer navigation"><Link href="/runs">Workspace<ArrowUpRight size={14} /></Link><Link href="/evaluation">Evaluation</Link><Link href="/settings">Settings</Link><a href="https://github.com/Yug-Shah17" target="_blank" rel="noopener noreferrer">GitHub<ArrowUpRight size={14} /></a><a href="https://www.linkedin.com/in/yug-shah-lnkdn/" target="_blank" rel="noopener noreferrer">LinkedIn<ArrowUpRight size={14} /></a><a href="#home-main">Back to top<ArrowUpRight size={14} /></a></nav><small>Built by Yug Shah / Independent project</small></footer>
  </div>;
}
