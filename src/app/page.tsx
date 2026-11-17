"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import RuntimeEngine from "@/components/runtime/runtime-engine";
import { Activity, AppWindow, ArrowUpRight, Box, Braces, ChevronDown, CircleHelp, Command, Download, Eye, FileCode2, FolderOpen, Gauge, GitBranch, Layers3, LayoutGrid, LockKeyhole, PanelLeftClose, PanelRightClose, Play, Plus, RefreshCw, Settings2, ShieldCheck, Sparkles, UploadCloud, WandSparkles, X } from "lucide-react";

const files = [
  { name: "index.html", type: "html", size: "2.4 KB", active: true },
  { name: "styles.css", type: "css", size: "8.1 KB" },
  { name: "app.js", type: "js", size: "4.7 KB" },
  { name: "README.md", type: "md", size: "1.2 KB" },
];

const nav = [
  { label: "Project", icon: FolderOpen },
  { label: "Visual Studio", icon: LayoutGrid, active: true },
  { label: "Code Studio", icon: Braces },
  { label: "Runtime Lab", icon: Activity },
  { label: "Design System", icon: Layers3 },
  { label: "Assets", icon: Box },
];

export default function Home() {
  const [activeFile, setActiveFile] = useState("index.html");
  const [rightOpen, setRightOpen] = useState(true);
  const [leftOpen, setLeftOpen] = useState(true);
  const [notice, setNotice] = useState("");
  const [importedProject, setImportedProject] = useState<{ id: string; name: string; kind: string; entrypoint: string | null; files: { path: string; size: number; isDirectory: boolean }[]; warnings: string[] } | null>(null);
  const [projectFiles, setProjectFiles] = useState<{ path: string; size: number; isDirectory: boolean; extension: string }[]>([]);
  const [selectedPath, setSelectedPath] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [draftText, setDraftText] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [editorMode, setEditorMode] = useState<"visual" | "code">("visual");
  const [previewVersion, setPreviewVersion] = useState(0);
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const previewRef = useRef<HTMLIFrameElement | null>(null);
  const [previewSession, setPreviewSession] = useState("");
  const [selectedElement, setSelectedElement] = useState<{ elementId: string; selector: string; tagName: string; classNames?: string[]; role: string; textPreview?: string; bounds: { x: number; y: number; width: number; height: number }; computed: Record<string, string> } | null>(null);
  const [hoveredElement, setHoveredElement] = useState<{ selector: string; tagName: string } | null>(null);
  const [visualColor, setVisualColor] = useState("#111827");
  const [visualBackground, setVisualBackground] = useState("#ffffff");
  const [visualFontSize, setVisualFontSize] = useState("16");
  const [visualWidth, setVisualWidth] = useState("");
  const [visualPadding, setVisualPadding] = useState("");
  const [visualRadius, setVisualRadius] = useState("");
  const [gradientStops, setGradientStops] = useState(["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b"]);
  const [gradientCount, setGradientCount] = useState<3 | 4>(3);
  const [visualSaving, setVisualSaving] = useState(false);
  const [visualStatus, setVisualStatus] = useState("");
  const [runtimeInfo, setRuntimeInfo] = useState<{ status: string; provider: string | null; canStart: boolean; message: string } | null>(null);
  const [runtimeStarting, setRuntimeStarting] = useState(false);
  const selected = useMemo(() => files.find((file) => file.name === activeFile), [activeFile]);

  useEffect(() => {
    if (!importedProject) {
      setPreviewSession("");
      setSelectedElement(null);
      return;
    }
    setPreviewSession(crypto.randomUUID());
    setSelectedElement(null);
  }, [importedProject]);

  useEffect(() => {
    if (!selectedElement) return;
    setVisualColor(selectedElement.computed.color || "#111827");
    setVisualBackground(selectedElement.computed.backgroundColor || "#ffffff");
    setVisualFontSize(String(parseFloat(selectedElement.computed.fontSize || "16") || 16));
    setVisualWidth(String(Math.round(selectedElement.bounds.width)));
    setVisualPadding(String(parseFloat(selectedElement.computed.paddingTop || "0") || 0));
    setVisualRadius(String(parseFloat(selectedElement.computed.borderRadius || "0") || 0));
  }, [selectedElement?.elementId]);

  async function applyVisualStyle(property: string, value: string) {
    if (!importedProject || !selectedElement || !previewRef.current?.contentWindow) return;
    const operationId = crypto.randomUUID();
    setVisualSaving(true);
    setVisualStatus("Saving visual change…");
    try {
      const response = await fetch(`/api/projects/${importedProject.id}/visual-edits`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selector: selectedElement.selector, tagName: selectedElement.tagName, classNames: selectedElement.classNames, property, value }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save visual change.");
      previewRef.current?.contentWindow?.postMessage({
        protocol: "studioforge.preview.v1", type: "apply-style", sessionId: previewSession,
        operationId, elementId: selectedElement.elementId, property, value,
      }, "*");
      setVisualStatus("Saved in " + data.sourceFile + " (" + data.matchedSelector + ")");
    } catch (error) {
      setVisualStatus(error instanceof Error ? error.message : "Visual save failed.");
    } finally {
      setVisualSaving(false);
    }
  }

  function applyGradient() {
    const stops = gradientStops.slice(0, gradientCount).map((color, index) => `${color} ${Math.round(index * 100 / (gradientCount - 1))}%`).join(", ");
    void applyVisualStyle("background-image", `linear-gradient(90deg, ${stops})`);
  }

  useEffect(() => {
    if (!importedProject || !previewSession) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (event.source !== previewRef.current?.contentWindow || !data || data.protocol !== "studioforge.preview.v1" || data.sessionId !== previewSession) return;
      if (data.type === "element-selected") {
        const element = data.element;
        if (element === null) { setSelectedElement(null); return; }
        if (!element || typeof element.elementId !== "string" || typeof element.selector !== "string" || typeof element.tagName !== "string" || !element.bounds || typeof element.bounds.width !== "number" || typeof element.bounds.height !== "number" || !element.computed || typeof element.computed !== "object") return;
        setSelectedElement(element);
      }
      if (data.type === "style-applied" && data.element && typeof data.element.elementId === "string") {
        setSelectedElement(data.element);
      }
      if (data.type === "element-hovered") {
        const element = data.element;
        if (element === null) setHoveredElement(null);
        else if (element && typeof element.selector === "string" && typeof element.tagName === "string") setHoveredElement({ selector: element.selector, tagName: element.tagName });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [importedProject, previewSession]);

  useEffect(() => {
    if (!importedProject) { setRuntimeInfo(null); return; }
    let cancelled = false;
    fetch(`/api/projects/${importedProject.id}/runtime`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => { if (!cancelled) setRuntimeInfo(data); })
      .catch(() => { if (!cancelled) setRuntimeInfo({ status: "error", provider: null, canStart: false, message: "Could not retrieve runtime status." }); });
    return () => { cancelled = true; };
  }, [importedProject?.id]);

  async function startProjectRuntime() {
    if (!importedProject || !runtimeInfo?.canStart || runtimeStarting) return;
    setRuntimeStarting(true);
    try {
      const response = await fetch(`/api/projects/${importedProject.id}/runtime`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Runtime could not start.");
      setRuntimeInfo({ status: data.status, provider: data.provider, canStart: false, message: data.message });
    } catch (error) {
      setRuntimeInfo((current) => current ? { ...current, message: error instanceof Error ? error.message : "Runtime could not start." } : null);
    } finally {
      setRuntimeStarting(false);
    }
  }

  useEffect(() => {
    if (!importedProject) return;
    let cancelled = false;
    fetch(`/api/projects/${importedProject.id}/files`).then((r) => r.json()).then((data) => {
      if (!cancelled && Array.isArray(data.files)) { setProjectFiles(data.files); if (data.files[0]) { setSelectedPath(data.files[0].path); setEditorMode("visual"); } }
    }).catch(() => { if (!cancelled) setNotice("Could not load project files."); });
    return () => { cancelled = true; };
  }, [importedProject]);

  useEffect(() => {
    if (!importedProject || !selectedPath) return;
    let cancelled = false;
    setSourceLoading(true);
    fetch(`/api/projects/${importedProject.id}/files?path=${encodeURIComponent(selectedPath)}`).then(async (r) => { const data = await r.json(); if (!r.ok) throw new Error(data.error || "Could not read file."); return data; }).then((data) => { if (!cancelled) { setSourceText(data.content ?? ""); setDraftText(data.content ?? ""); setDirty(false); setUndoStack([]); setRedoStack([]); setSaveError(""); } }).catch((error) => { if (!cancelled) setSourceText(error instanceof Error ? error.message : "Could not read file."); }).finally(() => { if (!cancelled) setSourceLoading(false); });
    return () => { cancelled = true; };
  }, [importedProject, selectedPath]);

  return (
    <main className="min-h-screen overflow-hidden bg-forge-bg text-forge-text">
      <header className="flex h-14 items-center justify-between border-b border-forge-line bg-[#0d1117] px-4">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-forge-accent text-[#07130f]"><WandSparkles size={18} /></div>
          <div className="font-semibold tracking-tight">StudioForge <span className="ml-1 text-xs font-medium text-forge-muted">EARLY ACCESS</span></div>
          <div className="mx-2 h-5 w-px bg-forge-line" />
          <button className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-300 hover:bg-white/5"><span className="h-2 w-2 rounded-full bg-forge-accent" /> {importedProject?.name ?? "Untitled project"} <ChevronDown size={14} /></button>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-md border border-forge-line px-2 py-1 text-[11px] text-forge-muted md:flex"><LockKeyhole size={12} /> Local workspace</span>
          <button onClick={() => setNotice("Runtime is not configured yet. Static ZIP workflow is the first milestone.")} className="flex items-center gap-2 rounded-md border border-forge-line px-3 py-1.5 text-sm hover:bg-white/5"><Play size={14} /> Run project</button>
          <button onClick={() => setNotice("Export Center will be enabled with the ZIP import/export milestone.")} className="flex items-center gap-2 rounded-md bg-forge-accent px-3 py-1.5 text-sm font-semibold text-[#07130f] hover:brightness-110"><Download size={14} /> Export</button>
        </div>
      </header>

      <div className="flex h-[calc(100vh-56px)] min-h-[620px]">
        {leftOpen && <aside className="flex w-[224px] shrink-0 flex-col border-r border-forge-line bg-[#0d1117]">
          <div className="flex h-11 items-center justify-between px-3 text-[11px] font-semibold uppercase tracking-[.12em] text-forge-muted"><span>Workspace</span><button onClick={() => setLeftOpen(false)} aria-label="Collapse sidebar"><PanelLeftClose size={15} /></button></div>
          <div className="space-y-1 px-2">
            {nav.map(({ label, icon: Icon, active }) => <button key={label} onClick={() => setNotice(label + " workspace is part of the staged build.")} className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] ${active ? "bg-white/[.08] text-white" : "text-slate-400 hover:bg-white/[.04] hover:text-slate-200"}`}><Icon size={15} />{label}{active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-forge-accent" />}</button>)}
          </div>
          <ProjectImportControl onImported={setImportedProject} />
          <div className="mx-3 my-4 border-t border-forge-line" />
          <div className="flex items-center justify-between px-4 pb-2 text-[10px] font-semibold uppercase tracking-[.12em] text-forge-muted"><span>Project files</span><button onClick={() => setNotice("Import flow is coming in the first vertical slice.")}><Plus size={14} /></button></div>
          {importedProject && <div className="mx-3 mb-2 rounded-md bg-forge-accent/5 px-2 py-2 text-[10px] text-forge-muted">Detected: <span className="text-forge-accent">{importedProject.kind}</span><br />{importedProject.files.length} archive entries</div>}
          <div className="space-y-0.5 px-2">
            {(importedProject ? projectFiles.map((file) => ({ name: file.path, size: `${Math.max(1, Math.round(file.size / 1024))} KB` })) : files).map((file) => <button key={file.name} onClick={() => { if (dirty && !window.confirm("Discard unsaved changes?")) return; setActiveFile(file.name); if (importedProject) { setSelectedPath(file.name); setEditorMode("visual"); } }} className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs ${activeFile === file.name ? "bg-forge-accent/10 text-forge-accent" : "text-slate-400 hover:bg-white/[.04]"}`}><FileCode2 size={14} />{file.name}<span className="ml-auto text-[10px] text-slate-600">{file.size}</span></button>)}
          </div>
          <div className="mt-auto border-t border-forge-line p-3">
            <div className="rounded-lg border border-forge-line bg-forge-panel p-3"><div className="mb-2 flex items-center gap-2 text-xs font-medium"><ShieldCheck size={14} className="text-forge-accent" /> Safe by design</div><p className="text-[11px] leading-relaxed text-forge-muted">Imported source stays unexecuted. Runtime execution is disabled until isolation is configured.</p></div>
            <button className="mt-3 flex w-full items-center gap-2 px-2 text-xs text-forge-muted hover:text-white"><Settings2 size={14} /> Preferences <span className="ml-auto">⌘ ,</span></button>
          </div>
        </aside>}

        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-11 items-center justify-between border-b border-forge-line bg-[#0d1117] px-3">
            <div className="flex items-center gap-2 text-xs text-forge-muted">{!leftOpen && <button onClick={() => setLeftOpen(true)}><PanelLeftClose size={15} /></button>}<span>Workspace</span><span>/</span><span className="text-slate-200">{activeFile}</span><span className="rounded bg-forge-raised px-1.5 py-0.5 text-[10px]">HTML</span></div>
            <div className="flex items-center gap-3"><span className="text-[11px] text-forge-muted">Preview mode <span className={importedProject?.entrypoint ? "text-forge-accent" : "text-amber-300"}>· {importedProject?.entrypoint ? "sanitized static" : "demo"}</span></span><button onClick={() => setRightOpen(!rightOpen)} aria-label="Toggle inspector"><PanelRightClose size={15} /></button></div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col bg-[#0a0d12]">
            <div className="flex h-10 items-center gap-1 border-b border-forge-line px-3"><button onClick={() => setEditorMode("visual")} className={`rounded-md px-3 py-1.5 text-xs ${editorMode === "visual" ? "bg-white/[.07] text-white" : "text-forge-muted hover:bg-white/[.04]"}`}><Eye size={13} className="mr-1.5 inline" />Visual</button><div className="ml-auto flex items-center gap-1 text-[11px] text-forge-muted"><button onClick={() => setViewport("desktop")} className={`rounded px-2 py-1 ${viewport === "desktop" ? "bg-white/10 text-white" : "hover:bg-white/5"}`}>Desktop</button><button onClick={() => setViewport("tablet")} className={`rounded px-2 py-1 ${viewport === "tablet" ? "bg-white/10 text-white" : "hover:bg-white/5"}`}>Tablet</button><button onClick={() => setViewport("mobile")} className={`rounded px-2 py-1 ${viewport === "mobile" ? "bg-white/10 text-white" : "hover:bg-white/5"}`}>Mobile</button>{importedProject?.entrypoint && <button onClick={() => setPreviewVersion((v) => v + 1)} className="ml-2 rounded p-1.5 hover:bg-white/10" title="Refresh preview"><RefreshCw size={13} /></button>}</div></div>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-5 md:p-8">
              {editorMode === "code" && importedProject ? <div className="h-full min-h-[480px] w-full overflow-hidden rounded-xl border border-forge-line bg-[#0d1117]"><div className="flex h-10 items-center justify-between border-b border-forge-line px-4 text-xs text-forge-muted"><span>{selectedPath || "Choose a file"}</span><div className="flex items-center gap-2"><span className={dirty ? "text-amber-300" : "text-forge-muted"}>{sourceLoading ? "Loading…" : dirty ? "● Unsaved changes" : "Saved"}</span><button disabled={!undoStack.length || sourceLoading} onClick={undoEdit} className="rounded px-2 py-1 hover:bg-white/10 disabled:opacity-30">Undo</button><button disabled={!redoStack.length || sourceLoading} onClick={redoEdit} className="rounded px-2 py-1 hover:bg-white/10 disabled:opacity-30">Redo</button><button disabled={!dirty || saving || sourceLoading} onClick={() => void saveSource()} className="rounded bg-forge-accent px-3 py-1 font-semibold text-[#07130f] disabled:opacity-40">{saving ? "Saving…" : "Save"}</button></div></div>{saveError && <div role="alert" className="border-b border-rose-500/20 px-4 py-2 text-xs text-rose-300">{saveError}</div>}<textarea spellCheck={false} aria-label="Source code editor" value={draftText} onChange={(event) => updateDraft(event.target.value)} disabled={sourceLoading || !selectedPath} className="h-[calc(100%-40px)] min-h-[400px] w-full resize-none bg-[#0d1117] p-4 font-mono text-xs leading-6 text-slate-200 outline-none focus:ring-1 focus:ring-inset focus:ring-forge-accent/40" placeholder={projectFiles.length ? "Select a text file from the project tree." : "No files found in this project."} /></div> : null}
              {editorMode === "visual" && importedProject?.entrypoint ? <div className={`h-full min-h-[480px] overflow-hidden rounded-xl border border-[#303946] bg-white shadow-2xl shadow-black/40 transition-[width] duration-200 ${viewport === "desktop" ? "w-full max-w-[1100px]" : viewport === "tablet" ? "w-[768px] max-w-full" : "w-[390px] max-w-full"}`}><div className="flex h-9 items-center justify-between border-b border-slate-200 bg-white px-3 text-[10px] text-slate-500"><span>Static preview · selection bridge only · project scripts disabled</span><span>{viewport === "desktop" ? "Responsive" : viewport === "tablet" ? "768 px" : "390 px"}</span></div><iframe key={`${importedProject.id}-${previewVersion}`} title="Imported project static preview" src={`/api/projects/${importedProject.id}/preview?v=${previewVersion}&session=${previewSession}`} ref={previewRef} sandbox="allow-scripts" referrerPolicy="no-referrer" className="h-[calc(100%-36px)] min-h-[444px] w-full bg-white" /></div> : null}
              {editorMode === "visual" && !importedProject ? <div className="w-full max-w-[980px] overflow-hidden rounded-xl border border-[#303946] bg-[#f7f8fa] shadow-2xl shadow-black/40">
                <div className="flex h-9 items-center gap-1.5 border-b border-slate-200 bg-white px-3"><span className="h-2.5 w-2.5 rounded-full bg-[#ff6159]" /><span className="h-2.5 w-2.5 rounded-full bg-[#ffbf2f]" /><span className="h-2.5 w-2.5 rounded-full bg-[#2acb42]" /><div className="mx-auto rounded-md bg-slate-100 px-20 py-1 text-[10px] text-slate-400">preview.studioforge.local</div></div>
                <div className="min-h-[480px] px-8 py-10 text-slate-900 md:px-16">
                  <div className="mx-auto max-w-[680px]">
                    <div className="mb-16 flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-bold"><div className="grid h-7 w-7 place-items-center rounded-lg bg-slate-900 text-white"><Command size={14} /></div>Northstar</div><div className="flex gap-5 text-[11px] text-slate-500"><span>Product</span><span>Solutions</span><span>Pricing</span></div><button className="rounded-md bg-slate-900 px-3 py-2 text-[10px] font-semibold text-white">Get started</button></div>
                    <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-semibold text-emerald-800"><Sparkles size={12} /> THE NEXT CHAPTER STARTS HERE</div>
                    <h1 className="max-w-[600px] text-4xl font-semibold leading-[1.08] tracking-[-.045em] md:text-6xl">Build something <span className="text-emerald-600">remarkable.</span></h1>
                    <p className="mt-6 max-w-[470px] text-sm leading-7 text-slate-500">A thoughtful workspace for teams turning ambitious ideas into meaningful products. Less friction, more forward motion.</p>
                    <div className="mt-8 flex items-center gap-3"><button className="rounded-md bg-slate-900 px-5 py-3 text-xs font-semibold text-white">Explore workspace <ArrowUpRight size={13} className="ml-2 inline" /></button><span className="text-xs text-slate-400">Designed for what’s next</span></div>
                    <div className="mt-16 grid grid-cols-3 gap-3">{[["01","Clarity first"],["02","Move together"],["03","Make it real"]].map(([n,t]) => <div key={n} className="border-t border-slate-200 pt-3"><div className="text-[10px] text-emerald-600">{n}</div><div className="mt-1 text-xs font-semibold">{t}</div></div>)}</div>
                  </div>
                </div>
              </div>
            </div>
              {importedProject && <RuntimeEngine projectId={importedProject.id} />}
            <div className="flex h-7 items-center justify-between border-t border-forge-line bg-[#0d1117] px-3 text-[10px] text-forge-muted"><div className="flex gap-4"><span className="flex items-center gap-1"><GitBranch size={11} /> main</span><span>{dirty ? "1 unsaved file" : "0 changes"}</span><span>UTF-8</span></div><div className="flex gap-3"><span>StudioForge core</span><span>v0.1.0</span></div></div>
          </div>
        </section>

        {rightOpen && <aside className="hidden w-[260px] shrink-0 flex-col border-l border-forge-line bg-[#0d1117] xl:flex">
          <div className="flex h-11 items-center justify-between border-b border-forge-line px-3 text-[11px] font-semibold uppercase tracking-[.12em] text-forge-muted"><span>Visual Inspector</span><span className="text-[10px] font-normal normal-case tracking-normal">{selectedElement ? "Selected" : "No selection"}</span></div>
          {selectedElement ? <div className="flex-1 overflow-auto p-3">
            <div className="mb-3 rounded-lg border border-forge-accent/30 bg-forge-accent/5 p-3"><div className="text-sm font-semibold text-white">{selectedElement.role}</div><div className="mt-1 break-all text-[10px] text-forge-accent">{selectedElement.selector}</div><div className="mt-2 text-xs text-slate-300">{selectedElement.textPreview || "No text content"}</div></div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-forge-muted">Dimensions</div>
            <div className="grid grid-cols-2 gap-2">{[["Width",selectedElement.bounds.width],["Height",selectedElement.bounds.height]].map(([label,value])=><div key={label} className="rounded-md bg-forge-panel p-2"><div className="text-[10px] text-forge-muted">{label}</div><div className="mt-1 text-sm tabular-nums text-white">{Math.round(Number(value))} px</div></div>)}</div>
            <div className="mb-2 mt-4 text-[10px] font-semibold uppercase tracking-wider text-forge-muted">Visual styling</div>
            <div className="space-y-3 rounded-lg border border-forge-line bg-forge-panel p-3">
              <div>
                <label className="mb-1 block text-[10px] text-forge-muted">Text color · HEX</label>
                <div className="flex gap-2"><input type="color" value={/^#[0-9a-f]{6}$/i.test(visualColor) ? visualColor : "#111827"} onChange={(e)=>{setVisualColor(e.target.value);void applyVisualStyle("color",e.target.value);}} className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent" /><input value={visualColor} onChange={(e)=>setVisualColor(e.target.value)} onBlur={()=>{if(/^#[0-9a-f]{6}$/i.test(visualColor)) void applyVisualStyle("color",visualColor);}} className="min-w-0 flex-1 rounded border border-forge-line bg-[#0a0d12] px-2 text-xs text-white" /></div>
              </div>
              <div>
                <label className="mb-1 block text-[10px] text-forge-muted">Background color · HEX</label>
                <div className="flex gap-2"><input type="color" value={/^#[0-9a-f]{6}$/i.test(visualBackground) ? visualBackground : "#ffffff"} onChange={(e)=>{setVisualBackground(e.target.value);void applyVisualStyle("background-color",e.target.value);}} className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent" /><input value={visualBackground} onChange={(e)=>setVisualBackground(e.target.value)} onBlur={()=>{if(/^#[0-9a-f]{6}$/i.test(visualBackground)) void applyVisualStyle("background-color",visualBackground);}} className="min-w-0 flex-1 rounded border border-forge-line bg-[#0a0d12] px-2 text-xs text-white" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[10px] text-forge-muted">Font size (px)<input type="number" min="1" max="200" value={visualFontSize} onChange={(e)=>setVisualFontSize(e.target.value)} onBlur={()=>{const n=Number(visualFontSize);if(n>0&&n<=200)void applyVisualStyle("font-size",n+"px");}} className="mt-1 w-full rounded border border-forge-line bg-[#0a0d12] px-2 py-1.5 text-xs text-white" /></label>
                <label className="text-[10px] text-forge-muted">Width (px)<input type="number" min="1" max="3000" value={visualWidth} onChange={(e)=>setVisualWidth(e.target.value)} onBlur={()=>{const n=Number(visualWidth);if(n>0&&n<=3000)void applyVisualStyle("width",n+"px");}} className="mt-1 w-full rounded border border-forge-line bg-[#0a0d12] px-2 py-1.5 text-xs text-white" /></label>
                <label className="text-[10px] text-forge-muted">Padding (px)<input type="number" min="0" max="500" value={visualPadding} onChange={(e)=>setVisualPadding(e.target.value)} onBlur={()=>{const n=Number(visualPadding);if(n>=0&&n<=500)void applyVisualStyle("padding",n+"px");}} className="mt-1 w-full rounded border border-forge-line bg-[#0a0d12] px-2 py-1.5 text-xs text-white" /></label>
                <label className="text-[10px] text-forge-muted">Corner radius (px)<input type="number" min="0" max="300" value={visualRadius} onChange={(e)=>setVisualRadius(e.target.value)} onBlur={()=>{const n=Number(visualRadius);if(n>=0&&n<=300)void applyVisualStyle("border-radius",n+"px");}} className="mt-1 w-full rounded border border-forge-line bg-[#0a0d12] px-2 py-1.5 text-xs text-white" /></label>
              </div>
              <div className="border-t border-forge-line pt-3">
                <div className="mb-2 flex items-center justify-between"><span className="text-[10px] font-semibold text-forge-muted">Gradient · 3 or 4 stops</span><select value={gradientCount} onChange={(e)=>setGradientCount(Number(e.target.value) as 3|4)} className="rounded border border-forge-line bg-[#0a0d12] px-2 py-1 text-[10px] text-white"><option value={3}>3 stops</option><option value={4}>4 stops</option></select></div>
                <div className="mb-2 h-5 rounded" style={{backgroundImage:`linear-gradient(90deg, ${gradientStops.slice(0,gradientCount).map((color,index)=>`${color} ${Math.round(index*100/(gradientCount-1))}%`).join(", ")})`}} />
                <div className="grid grid-cols-2 gap-2">{gradientStops.slice(0,gradientCount).map((color,index)=><label key={index} className="flex items-center gap-1 text-[10px] text-forge-muted"><input type="color" value={color} onChange={(e)=>setGradientStops((stops)=>stops.map((v,i)=>i===index?e.target.value:v))} className="h-7 w-8 cursor-pointer rounded border-0 bg-transparent" /><input value={color} onChange={(e)=>setGradientStops((stops)=>stops.map((v,i)=>i===index?e.target.value:v))} className="min-w-0 w-full rounded border border-forge-line bg-[#0a0d12] px-1.5 py-1 text-[10px] text-white" /></label>)}</div>
                <button onClick={applyGradient} className="mt-2 w-full rounded-md border border-forge-accent/40 px-2 py-2 text-[11px] font-medium text-forge-accent hover:bg-forge-accent/10">Apply gradient</button>
              </div>
              <button disabled={visualSaving} onClick={()=>setPreviewVersion((v)=>v+1)} className="w-full rounded-md bg-forge-accent px-3 py-2 text-[11px] font-semibold text-[#07130f] disabled:opacity-40">{visualSaving ? "Saving…" : "Refresh saved preview"}</button>
              {visualStatus && <p role="status" className="break-words text-[10px] leading-relaxed text-forge-muted">{visualStatus}</p>}
            </div>
            <div className="mb-2 mt-4 text-[10px] font-semibold uppercase tracking-wider text-forge-muted">Computed styles</div>
            {["display","position","fontFamily","fontSize","fontWeight","lineHeight","color","backgroundColor","backgroundImage","borderRadius","boxShadow","gap","paddingTop","paddingRight","paddingBottom","paddingLeft","marginTop","marginRight","marginBottom","marginLeft","justifyContent","alignItems","flexDirection","gridTemplateColumns"].map((key)=><div key={key} className="flex items-start justify-between gap-2 border-b border-forge-line py-2 text-[11px]"><span className="text-forge-muted">{key}</span><span className="max-w-[145px] break-all text-right text-slate-300">{selectedElement.computed[key] || "—"}</span></div>)}
            <p className="mt-3 text-[10px] leading-relaxed text-amber-200">Selection is connected. Visual property editing and source mapping are the next milestone.</p>
            <button onClick={()=>setSelectedElement(null)} className="mt-3 w-full rounded-md border border-forge-line px-3 py-2 text-xs text-slate-300 hover:bg-white/5">Clear selection</button>
          </div> : <div className="flex flex-1 flex-col items-center justify-center px-6 text-center"><div className="mb-4 grid h-12 w-12 place-items-center rounded-xl border border-forge-line bg-forge-panel text-forge-muted"><MousePointerIcon /></div><div className="text-sm font-medium text-slate-200">Select an element</div><p className="mt-2 text-xs leading-relaxed text-forge-muted">Hover and click an element in the preview. {hoveredElement ? "Hovering: "+hoveredElement.tagName+" · "+hoveredElement.selector : ""}</p></div>}
          <div className="border-t border-forge-line p-3"><div className="mb-2 flex items-center gap-2 text-xs font-medium"><Gauge size={14} className="text-forge-accent" /> Runtime Lab</div><div className="flex items-center justify-between rounded-md bg-forge-panel px-3 py-2 text-xs"><span className="text-forge-muted">Execution provider</span><span className={runtimeInfo?.status === "available" ? "text-forge-accent" : "text-amber-300"}>{runtimeInfo?.provider || "Not configured"}</span></div><p className="mt-2 text-[10px] leading-relaxed text-forge-muted">{runtimeInfo?.message || (importedProject ? "Checking runtime availability…" : "Import a project to inspect runtime compatibility.")}</p><p className="mt-2 text-[10px] leading-relaxed text-forge-muted">Use the Live Runtime Engine panel below the workspace preview to mount files, install packages, launch the app, view logs, and stop the browser runtime. Project scripts never run on the StudioForge app server.</p></div>
        </aside>}
      </div>
      {importedProject?.warnings?.length ? <div className="fixed bottom-16 left-1/2 z-40 max-w-lg -translate-x-1/2 rounded-lg border border-amber-500/30 bg-[#211b11] px-4 py-3 text-xs text-amber-100">{importedProject.warnings.join(" ")}</div> : null}
      {notice && <div role="status" className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-forge-line bg-[#171d27] px-4 py-3 text-xs text-slate-200 shadow-panel"><CircleHelp size={15} className="text-forge-accent" />{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={14} /></button></div>}
      <div className="sr-only">{selected?.name}</div>
    </main>
  );
}

function MousePointerIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m5 3 14 10-7 1-3 7L5 3Z" /></svg>;
}

function ProjectImportControl({ onImported }: { onImported: (project: { id: string; name: string; kind: string; entrypoint: string | null; files: { path: string; size: number; isDirectory: boolean }[]; warnings: string[] }) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  async function upload(file?: File) {
    if (!file) return;
    setError("");
    setBusy(true);
    setProgress("Inspecting archive…");
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/projects/import", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Import failed.");
      onImported(data.project);
      setProgress("Project imported");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Import failed.");
      setProgress("");
    } finally {
      setBusy(false);
    }
  }
  return <div className="px-2 pb-3">
    <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-forge-line px-2 py-2.5 text-xs text-slate-300 transition hover:border-forge-accent/60 hover:bg-forge-accent/5 ${busy ? "pointer-events-none opacity-60" : ""}`}>
      <UploadCloud size={14} /> {busy ? "Inspecting ZIP…" : "Import project ZIP"}
      <input className="sr-only" type="file" accept=".zip,application/zip" disabled={busy} onChange={(event) => { void upload(event.target.files?.[0]); event.currentTarget.value = ""; }} />
    </label>
    {progress && <p className="mt-1.5 text-[10px] text-forge-accent">{progress}</p>}
    {error && <p className="mt-1.5 text-[10px] leading-relaxed text-rose-300">{error}</p>}
  </div>;
}
