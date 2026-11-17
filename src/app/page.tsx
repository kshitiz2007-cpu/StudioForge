"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, AppWindow, ArrowUpRight, Box, Braces, ChevronDown, CircleHelp, Command, Download, Eye, FileCode2, FolderOpen, Gauge, GitBranch, Layers3, LayoutGrid, LockKeyhole, PanelLeftClose, PanelRightClose, Play, Plus, Search, Settings2, ShieldCheck, Sparkles, UploadCloud, WandSparkles, X } from "lucide-react";

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
  const [importedProject, setImportedProject] = useState<{ id: string; name: string; kind: string; files: { path: string; size: number; isDirectory: boolean }[]; warnings: string[] } | null>(null);\n  const [projectFiles, setProjectFiles] = useState<{ path: string; size: number; isDirectory: boolean; extension: string }[]>([]);\n  const [selectedPath, setSelectedPath] = useState("");\n  const [sourceText, setSourceText] = useState("");\n  const [sourceLoading, setSourceLoading] = useState(false);\n  const [editorMode, setEditorMode] = useState<"visual" | "code">("visual");
  const selected = useMemo(() => files.find((file) => file.name === activeFile), [activeFile]);\n\n  useEffect(() => {\n    if (!importedProject) return;\n    let cancelled = false;\n    fetch(`/api/projects/${importedProject.id}/files`).then((r) => r.json()).then((data) => {\n      if (!cancelled && Array.isArray(data.files)) { setProjectFiles(data.files); if (data.files[0]) { setSelectedPath(data.files[0].path); setEditorMode("code"); } }\n    }).catch(() => { if (!cancelled) setNotice("Could not load project files."); });\n    return () => { cancelled = true; };\n  }, [importedProject]);\n\n  useEffect(() => {\n    if (!importedProject || !selectedPath) return;\n    let cancelled = false;\n    setSourceLoading(true);\n    fetch(`/api/projects/${importedProject.id}/files?path=${encodeURIComponent(selectedPath)}`).then(async (r) => { const data = await r.json(); if (!r.ok) throw new Error(data.error || "Could not read file."); return data; }).then((data) => { if (!cancelled) setSourceText(data.content ?? ""); }).catch((error) => { if (!cancelled) setSourceText(error instanceof Error ? error.message : "Could not read file."); }).finally(() => { if (!cancelled) setSourceLoading(false); });\n    return () => { cancelled = true; };\n  }, [importedProject, selectedPath]);

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
          <ProjectImportControl onImported={setImportedProject} />\n          <div className="mx-3 my-4 border-t border-forge-line" />
          <div className="flex items-center justify-between px-4 pb-2 text-[10px] font-semibold uppercase tracking-[.12em] text-forge-muted"><span>Project files</span><button onClick={() => setNotice("Import flow is coming in the first vertical slice.")}><Plus size={14} /></button></div>
          {importedProject && <div className="mx-3 mb-2 rounded-md bg-forge-accent/5 px-2 py-2 text-[10px] text-forge-muted">Detected: <span className="text-forge-accent">{importedProject.kind}</span><br />{importedProject.files.length} archive entries</div>}\n          <div className="space-y-0.5 px-2">
            {(importedProject ? projectFiles.map((file) => ({ name: file.path, size: `${Math.max(1, Math.round(file.size / 1024))} KB` })) : files).map((file) => <button key={file.name} onClick={() => { setActiveFile(file.name); if (importedProject) { setSelectedPath(file.name); setEditorMode("code"); } }} className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs ${activeFile === file.name ? "bg-forge-accent/10 text-forge-accent" : "text-slate-400 hover:bg-white/[.04]"}`}><FileCode2 size={14} />{file.name}<span className="ml-auto text-[10px] text-slate-600">{file.size}</span></button>)}
          </div>
          <div className="mt-auto border-t border-forge-line p-3">
            <div className="rounded-lg border border-forge-line bg-forge-panel p-3"><div className="mb-2 flex items-center gap-2 text-xs font-medium"><ShieldCheck size={14} className="text-forge-accent" /> Safe by design</div><p className="text-[11px] leading-relaxed text-forge-muted">Imported source stays unexecuted. Runtime execution is disabled until isolation is configured.</p></div>
            <button className="mt-3 flex w-full items-center gap-2 px-2 text-xs text-forge-muted hover:text-white"><Settings2 size={14} /> Preferences <span className="ml-auto">⌘ ,</span></button>
          </div>
        </aside>}

        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-11 items-center justify-between border-b border-forge-line bg-[#0d1117] px-3">
            <div className="flex items-center gap-2 text-xs text-forge-muted">{!leftOpen && <button onClick={() => setLeftOpen(true)}><PanelLeftClose size={15} /></button>}<span>Workspace</span><span>/</span><span className="text-slate-200">{activeFile}</span><span className="rounded bg-forge-raised px-1.5 py-0.5 text-[10px]">HTML</span></div>
            <div className="flex items-center gap-3"><span className="text-[11px] text-forge-muted">Preview mode <span className="text-amber-300">· not connected</span></span><button onClick={() => setRightOpen(!rightOpen)} aria-label="Toggle inspector"><PanelRightClose size={15} /></button></div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col bg-[#0a0d12]">
            <div className="flex h-10 items-center gap-1 border-b border-forge-line px-3"><button onClick={() => setEditorMode("visual")} className={`rounded-md px-3 py-1.5 text-xs ${editorMode === "visual" ? "bg-white/[.07] text-white" : "text-forge-muted hover:bg-white/[.04]"}`}><Eye size={13} className="mr-1.5 inline" />Visual</button><button onClick={() => setEditorMode("code")} className={`rounded-md px-3 py-1.5 text-xs ${editorMode === "code" ? "bg-white/[.07] text-white" : "text-forge-muted hover:bg-white/[.04]"}`}><Braces size={13} className="mr-1.5 inline" />Code</button><div className="ml-auto flex items-center gap-2 text-[11px] text-forge-muted"><span>Desktop</span><span className="text-slate-600">1440 × 900</span></div></div>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-5 md:p-8">\n              {editorMode === "code" && importedProject ? <div className="h-full min-h-[480px] w-full overflow-hidden rounded-xl border border-forge-line bg-[#0d1117]"><div className="flex h-10 items-center justify-between border-b border-forge-line px-4 text-xs text-forge-muted"><span>{selectedPath || "Choose a file"}</span><span>{sourceLoading ? "Loading…" : "Read-only source view"}</span></div><pre className="h-[calc(100%-40px)] overflow-auto p-4 text-xs leading-6 text-slate-300"><code>{sourceText || (projectFiles.length ? "Select a file from the project tree." : "No files found in this project.")}</code></pre></div> : null}\n              {editorMode === "visual" || !importedProject ? <div className="w-full max-w-[980px] overflow-hidden rounded-xl border border-[#303946] bg-[#f7f8fa] shadow-2xl shadow-black/40">
              <div className="w-full max-w-[980px] overflow-hidden rounded-xl border border-[#303946] bg-[#f7f8fa] shadow-2xl shadow-black/40">
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
            <div className="flex h-7 items-center justify-between border-t border-forge-line bg-[#0d1117] px-3 text-[10px] text-forge-muted"><div className="flex gap-4"><span className="flex items-center gap-1"><GitBranch size={11} /> main</span><span>0 changes</span><span>UTF-8</span></div><div className="flex gap-3"><span>StudioForge core</span><span>v0.1.0</span></div></div>
          </div>
        </section>

        {rightOpen && <aside className="hidden w-[260px] shrink-0 flex-col border-l border-forge-line bg-[#0d1117] xl:flex">
          <div className="flex h-11 items-center justify-between border-b border-forge-line px-3 text-[11px] font-semibold uppercase tracking-[.12em] text-forge-muted"><span>Inspector</span><span className="text-[10px] font-normal normal-case tracking-normal">No selection</span></div>
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center"><div className="mb-4 grid h-12 w-12 place-items-center rounded-xl border border-forge-line bg-forge-panel text-forge-muted"><MousePointerIcon /></div><div className="text-sm font-medium text-slate-200">Nothing selected</div><p className="mt-2 text-xs leading-relaxed text-forge-muted">Select an element in the preview to inspect its layout, styles and responsive behavior.</p></div>
          <div className="border-t border-forge-line p-3"><div className="mb-2 flex items-center gap-2 text-xs font-medium"><Gauge size={14} className="text-forge-accent" /> Runtime status</div><div className="flex items-center justify-between rounded-md bg-forge-panel px-3 py-2 text-xs"><span className="text-forge-muted">Execution provider</span><span className="text-amber-300">Not configured</span></div><p className="mt-2 text-[10px] leading-relaxed text-forge-muted">Project execution remains disabled until a secure runtime adapter is connected.</p></div>
        </aside>}
      </div>
      {importedProject?.warnings?.length ? <div className="fixed bottom-16 left-1/2 z-40 max-w-lg -translate-x-1/2 rounded-lg border border-amber-500/30 bg-[#211b11] px-4 py-3 text-xs text-amber-100">{importedProject.warnings.join(" ")}</div> : null}\n      {notice && <div role="status" className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-forge-line bg-[#171d27] px-4 py-3 text-xs text-slate-200 shadow-panel"><CircleHelp size={15} className="text-forge-accent" />{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={14} /></button></div>}
      <div className="sr-only">{selected?.name}</div>
    </main>
  );
}

function MousePointerIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m5 3 14 10-7 1-3 7L5 3Z" /></svg>;
}

function ProjectImportControl({ onImported }: { onImported: (project: { id: string; name: string; kind: string; files: { path: string; size: number; isDirectory: boolean }[]; warnings: string[] }) => void }) {
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
