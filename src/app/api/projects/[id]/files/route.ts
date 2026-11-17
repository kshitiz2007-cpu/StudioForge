import { readFile, stat } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TEXT_EXTENSIONS = new Set([".html", ".htm", ".css", ".js", ".jsx", ".ts", ".tsx", ".json", ".md", ".txt", ".svg", ".xml", ".yml", ".yaml", ".toml", ".sh"]);

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
    const info = await stat(target);
    if (!info.isFile() || info.size > 1024 * 1024) {
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
