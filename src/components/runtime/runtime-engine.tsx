"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Square, Terminal, ExternalLink } from "lucide-react";

type RuntimeFile = { path: string; contents: string; encoding: "utf8" | "base64" };
type LogLine = { id: number; stream: "stdout" | "stderr" | "system"; text: string };
type EngineState = "idle" | "mounting" | "installing" | "starting" | "running" | "stopping" | "error";

let sharedContainer: import("@webcontainer/api").WebContainer | null = null;
let activeProjectId = "";
let bootPromise: Promise<import("@webcontainer/api").WebContainer> | null = null;
let nextLogId = 0;

function appendTree(tree: Record<string, unknown>, file: RuntimeFile) {
  const parts = file.path.split("/");
  let cursor = tree;
  for (const part of parts.slice(0, -1)) {
    const existing = cursor[part] as { directory?: Record<string, unknown> } | undefined;
    if (!existing) cursor[part] = { directory: {} };
    cursor = (cursor[part] as { directory: Record<string, unknown> }).directory;
  }
  const content = file.encoding === "utf8" ? file.contents : Uint8Array.from(atob(file.contents), (c) => c.charCodeAt(0));
  cursor[parts[parts.length - 1]] = { file: { contents: content } };
}

function chooseLaunchScript(pkg: { scripts?: Record<string, unknown> }) {
  const scripts = pkg.scripts ?? {};
  for (const name of ["dev", "start", "preview"]) {
    const value = scripts[name];
    if (typeof value === "string" && value.trim() && value.length < 300 && !/[\n\r]/.test(value)) return name;
  }
  return null;
}

export default function RuntimeEngine({ projectId }: { projectId: string }) {
  const [state, setState] = useState<EngineState>("idle");
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");
  const [script, setScript] = useState("");
  const [packageManager, setPackageManager] = useState("npm");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const startupTimerRef = useRef<number | null>(null);
  const serverReadyUnsubscribeRef = useRef<(() => void) | null>(null);
  const readyRef = useRef(false);
  const processRef = useRef<import("@webcontainer/api").WebContainerProcess | null>(null);
  const log = (stream: LogLine["stream"], text: string) => {
    setLogs((current) => [...current.slice(-399), { id: ++nextLogId, stream, text }]);
  };

  useEffect(() => () => {
    // Runtime intentionally survives panel unmounts; explicit Stop owns teardown.
  }, []);

  useEffect(() => {
    const onSourceSaved = async (event: Event) => {
      const detail = (event as CustomEvent<{ projectId?: string; path?: string; content?: string }>).detail;
      if (!detail || detail.projectId !== projectId || !sharedContainer || activeProjectId !== projectId) return;
      if (typeof detail.path !== "string" || typeof detail.content !== "string") return;
      const normalized = detail.path.replace(/\\/g, "/");
      if (!normalized || normalized.startsWith("/") || normalized.split("/").some((part) => !part || part === "." || part === "..")) {
        log("stderr", "Rejected unsafe runtime file update path.");
        return;
      }
      try {
        await sharedContainer.fs.writeFile(normalized, detail.content);
        log("system", `Updated ${normalized} in the running runtime. The dev server can apply hot reload automatically.`);
        if (normalized === "package.json") {
          log("system", "package.json changed; reinstalling dependencies…");
          const install = await sharedContainer.spawn(packageManager, ["install"]);
          void install.output.pipeTo(new WritableStream({ write(data) { log("stdout", data); } }));
          const code = await install.exit;
          if (code !== 0) log("stderr", `Dependency refresh exited with code ${code}.`);
          else log("system", "Dependencies refreshed.");
        }
      } catch (reason) {
        log("stderr", reason instanceof Error ? reason.message : "Could not sync saved file to runtime.");
      }
    };
    window.addEventListener("studioforge:source-saved", onSourceSaved);
    return () => window.removeEventListener("studioforge:source-saved", onSourceSaved);
  }, [projectId, packageManager]);

  async function start() {
    if (state !== "idle" && state !== "error") return;
    setError(""); setLogs([]); setPreviewUrl(""); readyRef.current = false; setState("mounting");
    if (startupTimerRef.current !== null) window.clearTimeout(startupTimerRef.current);
    serverReadyUnsubscribeRef.current?.(); serverReadyUnsubscribeRef.current = null;
    try {
      if (!window.isSecureContext || !("crossOriginIsolated" in window) || !window.crossOriginIsolated) {
        throw new Error("This page is not cross-origin isolated. Restart the app after enabling COOP/COEP headers, then hard-refresh.");
      }
      const response = await fetch(`/api/projects/${projectId}/runtime-files`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not read project files.");
      const files = payload.files as RuntimeFile[];
      const pkgFile = files.find((file) => file.path === "package.json");
      if (!pkgFile || pkgFile.encoding !== "utf8") throw new Error("A readable root package.json is required.");
      const pkg = JSON.parse(pkgFile.contents) as { scripts?: Record<string, unknown>; packageManager?: string };
      const launchScript = chooseLaunchScript(pkg);
      if (!launchScript) throw new Error("No supported dev, start, or preview script was found in package.json.");
      const declaredManager = typeof pkg.packageManager === "string" ? pkg.packageManager.split("@")[0] : "";
      const manager = files.some((f) => f.path === "pnpm-lock.yaml") || declaredManager === "pnpm" ? "pnpm" : files.some((f) => f.path === "yarn.lock") || declaredManager === "yarn" ? "yarn" : "npm";
      if (declaredManager && !["npm", "pnpm", "yarn"].includes(declaredManager)) throw new Error(`Unsupported package manager: ${declaredManager}. Use npm, pnpm, or yarn.`);
      setPackageManager(manager); setScript(launchScript);
      log("system", `Mounting ${files.length} project files (${Math.round(payload.totalBytes / 1024)} KB)…`);
      if (sharedContainer && activeProjectId !== projectId) {
        await sharedContainer.teardown(); sharedContainer = null; bootPromise = null;
      }
      if (!sharedContainer) {
        if (!bootPromise) bootPromise = import("@webcontainer/api").then(({ WebContainer }) => WebContainer.boot({ coep: "require-corp", forwardPreviewErrors: true }));
        try { sharedContainer = await bootPromise; }
        catch (bootError) { bootPromise = null; throw bootError; }
        bootPromise = null;
      }
      activeProjectId = projectId;
      const container = sharedContainer;
      const tree: Record<string, unknown> = {};
      for (const file of files) appendTree(tree, file);
      await container.mount(tree as import("@webcontainer/api").FileSystemTree);
      log("system", "Project files mounted in browser runtime.");
      setState("installing");
      const install = await container.spawn(manager, ["install"]);
      void install.output.pipeTo(new WritableStream({ write(data) { log("stdout", data); } }));
      const installCode = await install.exit;
      if (installCode !== 0) throw new Error(`npm install exited with code ${installCode}.`);
      log("system", "Dependencies installed.");
      setState("starting");
      serverReadyUnsubscribeRef.current = container.on("server-ready", (port, url) => {
        readyRef.current = true;
        if (startupTimerRef.current !== null) window.clearTimeout(startupTimerRef.current);
        setPreviewUrl(url); setState("running"); log("system", `Dev server ready on port ${port}.`);
      });
      const dev = await container.spawn(manager, ["run", launchScript]);
      processRef.current = dev;
      void dev.output.pipeTo(new WritableStream({ write(data) { log("stdout", data); } }));
      void dev.exit.then((code) => {
        if (code !== 0) { log("stderr", `Development process exited with code ${code}.`); setState((s) => s === "stopping" ? s : "error"); }
      });
      log("system", `Running ${manager} run ${launchScript}…`);
      startupTimerRef.current = window.setTimeout(() => {
        if (!readyRef.current) {
          setState("error");
          setError("The dev server did not announce a preview URL within 120 seconds.");
        }
      }, 120000);
    } catch (reason) {
      if (startupTimerRef.current !== null) window.clearTimeout(startupTimerRef.current);
      serverReadyUnsubscribeRef.current?.(); serverReadyUnsubscribeRef.current = null;
      if (sharedContainer) { try { sharedContainer.teardown(); } catch { /* Runtime already disposed. */ } sharedContainer = null; activeProjectId = ""; bootPromise = null; }
      setError(reason instanceof Error ? reason.message : "Runtime failed.");
      log("stderr", reason instanceof Error ? reason.message : "Runtime failed.");
      setState("error");
    }
  }

  async function stop() {
    setState("stopping");
    if (startupTimerRef.current !== null) window.clearTimeout(startupTimerRef.current);
    try {
      if (processRef.current) { await processRef.current.kill(); processRef.current = null; }
      if (sharedContainer) { await sharedContainer.teardown(); sharedContainer = null; bootPromise = null; }
      readyRef.current = false; activeProjectId = ""; setPreviewUrl(""); setState("idle"); log("system", "Runtime stopped and browser workspace torn down.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not stop runtime.");
      setState("error");
    }
  }

  return <section className="mt-4 overflow-hidden rounded-xl border border-forge-line bg-[#0d1117]">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-forge-line px-4 py-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-200"><Terminal size={14} className="text-forge-accent" /> Live Runtime Engine <span className="rounded bg-forge-panel px-2 py-1 text-[10px] font-normal text-forge-muted">WebContainer · {packageManager}</span></div>
      <div className="flex items-center gap-2">
        <span className={`text-[10px] ${state === "running" ? "text-forge-accent" : state === "error" ? "text-rose-300" : "text-forge-muted"}`}>{state.toUpperCase()}</span>
        {state === "idle" || state === "error" ? <button onClick={() => void start()} className="flex items-center gap-1.5 rounded-md bg-forge-accent px-3 py-1.5 text-[11px] font-semibold text-[#07130f]"><Play size={12} /> Start</button> : <button onClick={() => void stop()} disabled={state === "stopping"} className="flex items-center gap-1.5 rounded-md border border-forge-line px-3 py-1.5 text-[11px] text-slate-200 disabled:opacity-40"><Square size={11} /> Stop & clean up</button>}
      </div>
    </div>
    {error && <p role="alert" className="border-b border-rose-500/20 bg-rose-500/5 px-4 py-2 text-[11px] text-rose-300">{error}</p>}
    {previewUrl && <div className="border-b border-forge-line">
      <div className="flex items-center justify-between px-3 py-2 text-[10px] text-forge-muted"><span>Live application preview · {packageManager} run {script}</span><a href={previewUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-forge-accent">Open separately <ExternalLink size={11} /></a></div>
      <iframe ref={iframeRef} title="Live project runtime preview" src={previewUrl} allow="cross-origin-isolated" className="h-[420px] w-full bg-white" />
    </div>}
    <div className="max-h-56 overflow-auto bg-[#080b10] p-3 font-mono text-[10px] leading-5" aria-live="polite">
      {logs.length ? logs.map((line) => <div key={line.id} className={line.stream === "stderr" ? "whitespace-pre-wrap text-rose-300" : line.stream === "system" ? "whitespace-pre-wrap text-forge-accent" : "whitespace-pre-wrap text-slate-300"}>{line.text}</div>) : <span className="text-forge-muted">Runtime output will appear here after you start a project.</span>}
    </div>
    <div className="border-t border-forge-line px-3 py-2 text-[10px] text-forge-muted">Runs in this browser tab. Environment files/private keys are excluded; network access and package downloads depend on the browser runtime and package registry. Not a remote multi-tenant security boundary.</div>
  </section>;
}
