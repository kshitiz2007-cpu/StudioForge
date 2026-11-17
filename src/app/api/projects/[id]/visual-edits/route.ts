import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { applyFrameworkStyleEdit } from "@/lib/visual/framework-style-adapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!ID_PATTERN.test(id)) return Response.json({ error: "Project not found." }, { status: 404 });
  if (process.env.NODE_ENV === "production" && process.env.STUDIOFORGE_ENABLE_UNAUTHENTICATED_LOCAL_IMPORT !== "true") {
    return Response.json({ error: "Local visual editing is disabled in production until authentication and ownership checks are configured." }, { status: 403 });
  }

  let payload: { selector?: unknown; tagName?: unknown; classNames?: unknown; property?: unknown; value?: unknown };
  try { payload = await request.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  if (typeof payload.selector !== "string" || typeof payload.property !== "string" || typeof payload.value !== "string") {
    return Response.json({ error: "A selector, property and value are required." }, { status: 400 });
  }
  if (payload.selector.length > 500 || !/^[a-zA-Z0-9_#.[\\]:> +"'()=-]+$/.test(payload.selector)) {
    return Response.json({ error: "The selected element does not have a safe, persistent selector." }, { status: 400 });
  }
  const classNames = Array.isArray(payload.classNames)
    ? payload.classNames.filter((name): name is string => typeof name === "string" && /^[\w-]{1,100}$/.test(name)).slice(0, 30)
    : [];
  const tagName = typeof payload.tagName === "string" && /^[a-z][a-z0-9-]{0,40}$/i.test(payload.tagName) ? payload.tagName : undefined;

  const projectDir = path.join(process.cwd(), ".studioforge", "projects", id);
  try {
    const manifestPath = path.join(projectDir, "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      id: string; kind: string; files: { path: string; size: number; isDirectory?: boolean }[];
    };
    if (manifest.id !== id) return Response.json({ error: "Project not found." }, { status: 404 });
    const filesRoot = path.join(projectDir, "files");
    const change = await applyFrameworkStyleEdit(filesRoot, manifest, {
      selector: payload.selector, tagName, classNames, property: payload.property, value: payload.value,
    });
    const changedFile = manifest.files.find((file) => file.path === change.path);
    if (changedFile) changedFile.size = Buffer.byteLength(change.content, "utf8");
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), { encoding: "utf8", mode: 0o600 });
    return Response.json({
      saved: true,
      adapter: manifest.kind,
      sourceFile: change.path,
      matchedSelector: change.matchedSelector,
      property: payload.property,
      value: payload.value,
      strategy: change.strategy,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save visual style.";
    const status = /No existing source stylesheet rule matched|not supported|Invalid CSS|Unsafe CSS/.test(message) ? 422 : 500;
    return Response.json({ error: message }, { status });
  }
}
