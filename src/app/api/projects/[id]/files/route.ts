import { lstat, readFile, realpath, rename, stat, writeFile, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TEXT_EXTENSIONS = new Set([".html", ".htm", ".css", ".js", ".jsx", ".ts", ".tsx", ".json", ".md", ".txt", ".svg", ".xml", ".yml", ".yaml", ".toml", ".sh"]);
const MAX_TEXT_BYTES = 1024 * 1024;

function safeProjectFile(projectRoot: string, relative: string) {
  const normalized = relative.replace(/\\/g, "/");
  if (!normalized || normalized.startsWith("/") || normalized.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error("Invalid file path.");
  }
  const root = path.resolve(projectRoot);
  const target = path.resolve(root, normalized);
  if (!target.startsWith(root + path.sep)) throw new Error("Invalid file path.");
  return target;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!ID_PATTERN.test(id)) return Response.json({ error: "Project not found." }, { status: 404 });

  const projectDir = path.join(process.cwd(), ".studioforge", "projects", id);
  try {
    const manifest = JSON.parse(await readFile(path.join(projectDir, "manifest.json"), "utf8")) as {
      id: string;
      files: { path: string; size: number; isDirectory: boolean }[];
    };
    if (manifest.id !== id) return Response.json({ error: "Project not found." }, { status: 404 });

    const requestedPath = new URL(request.url).searchParams.get("path");
    if (!requestedPath) {
      return Response.json({
        files: manifest.files.map((file) => ({ ...file, extension: path.extname(file.path).toLowerCase() })),
      });
    }

    const target = safeProjectFile(path.join(projectDir, "files"), requestedPath);
    const extension = path.extname(target).toLowerCase();
    if (!TEXT_EXTENSIONS.has(extension)) {
      return Response.json({ error: "This file type is not available in the text viewer." }, { status: 415 });
    }
    const info = await lstat(target);
    const rootReal = await realpath(path.join(projectDir, "files"));
    const targetReal = await realpath(target);
    if (!info.isFile() || info.isSymbolicLink() || !targetReal.startsWith(rootReal + path.sep) || info.size > MAX_TEXT_BYTES) {
      return Response.json({ error: "File is missing or exceeds the 1 MB text-view limit." }, { status: 413 });
    }
    const content = await readFile(target, "utf8");
    return Response.json({ path: requestedPath, content, size: info.size, extension });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Invalid file path.") return Response.json({ error: message }, { status: 400 });
    return Response.json({ error: "Project or file not found." }, { status: 404 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!ID_PATTERN.test(id)) return Response.json({ error: "Project not found." }, { status: 404 });
  if (process.env.NODE_ENV === "production" && process.env.STUDIOFORGE_ENABLE_UNAUTHENTICATED_LOCAL_IMPORT !== "true") {
    return Response.json({ error: "Local editing is disabled in production until authentication and ownership checks are configured." }, { status: 403 });
  }
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_TEXT_BYTES + 4096) return Response.json({ error: "Source exceeds the 1 MB save limit." }, { status: 413 });

  let payload: { path?: unknown; content?: unknown };
  try { payload = await request.json(); }
  catch { return Response.json({ error: "Invalid JSON request." }, { status: 400 }); }
  if (typeof payload.path !== "string" || typeof payload.content !== "string") {
    return Response.json({ error: "A file path and string content are required." }, { status: 400 });
  }
  if (Buffer.byteLength(payload.content, "utf8") > MAX_TEXT_BYTES) {
    return Response.json({ error: "Source exceeds the 1 MB save limit." }, { status: 413 });
  }

  const projectDir = path.join(process.cwd(), ".studioforge", "projects", id);
  try {
    const manifestPath = path.join(projectDir, "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      id: string; files: { path: string; size: number; isDirectory: boolean }[];
    };
    if (manifest.id !== id) return Response.json({ error: "Project not found." }, { status: 404 });
    const entry = manifest.files.find((file) => file.path === payload.path && !file.isDirectory);
    if (!entry) return Response.json({ error: "File is not part of this project." }, { status: 404 });

    const target = safeProjectFile(path.join(projectDir, "files"), payload.path);
    if (!TEXT_EXTENSIONS.has(path.extname(target).toLowerCase())) {
      return Response.json({ error: "This file type is not editable." }, { status: 415 });
    }
    const info = await lstat(target);
    const filesRoot = path.join(projectDir, "files");
    const rootReal = await realpath(filesRoot);
    const targetReal = await realpath(target);
    if (!info.isFile() || info.isSymbolicLink() || !targetReal.startsWith(rootReal + path.sep)) {
      return Response.json({ error: "Unsafe file target." }, { status: 400 });
    }

    const temporary = path.join(path.dirname(target), `.studioforge-${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, payload.content, { encoding: "utf8", flag: "wx", mode: 0o600 });
      await rename(temporary, target);
    } catch (error) {
      await unlink(temporary).catch(() => undefined);
      throw error;
    }
    entry.size = (await stat(target)).size;
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), { encoding: "utf8", mode: 0o600 });
    return Response.json({ saved: true, path: payload.path, size: entry.size });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Invalid file path.") return Response.json({ error: message }, { status: 400 });
    return Response.json({ error: "Could not save project file." }, { status: 404 });
  }
}
