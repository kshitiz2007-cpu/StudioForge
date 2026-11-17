import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_RUNTIME_BYTES = 40 * 1024 * 1024;
const EXCLUDED = /(^|\/)(node_modules|\.git|\.next|dist|build|coverage)(\/|$)/i;
const SECRET_FILE = /(^|\/)(\.env(?:\..*)?|.*\.(?:pem|key|p12|pfx)|id_rsa|id_ed25519)$/i;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!ID_PATTERN.test(id)) return Response.json({ error: "Project not found." }, { status: 404 });
  if (process.env.NODE_ENV === "production" && process.env.STUDIOFORGE_ENABLE_UNAUTHENTICATED_LOCAL_IMPORT !== "true") {
    return Response.json({ error: "Runtime file access requires authenticated project ownership in production." }, { status: 403 });
  }
  const projectDir = path.join(process.cwd(), ".studioforge", "projects", id);
  try {
    const manifest = JSON.parse(await readFile(path.join(projectDir, "manifest.json"), "utf8")) as {
      id: string; files: { path: string; size: number; isDirectory: boolean }[];
    };
    if (manifest.id !== id) return Response.json({ error: "Project not found." }, { status: 404 });
    const filesRoot = path.join(projectDir, "files");
    const rootReal = await realpath(filesRoot);
    const files: { path: string; contents: string; encoding: "utf8" | "base64" }[] = [];
    let total = 0;
    for (const entry of manifest.files) {
      const relative = entry.path.replace(/\\/g, "/");
      if (entry.isDirectory || EXCLUDED.test(relative) || SECRET_FILE.test(relative)) continue;
      if (!relative || relative.startsWith("/") || relative.split("/").some((part) => !part || part === "." || part === "..")) continue;
      const target = path.resolve(filesRoot, relative);
      if (!target.startsWith(filesRoot + path.sep)) continue;
      try {
        const info = await lstat(target);
        const targetReal = await realpath(target);
        if (!info.isFile() || info.isSymbolicLink() || !targetReal.startsWith(rootReal + path.sep)) continue;
        if (info.size > 5 * 1024 * 1024 || total + info.size > MAX_RUNTIME_BYTES) {
          return Response.json({ error: "Runtime mount is limited to 40 MB total and 5 MB per file. Remove large assets and retry." }, { status: 413 });
        }
        const data = await readFile(target);
        total += data.byteLength;
        const isText = /\.(?:html?|css|[cm]?js|jsx|tsx?|json|md|txt|svg|xml|ya?ml|toml|mjs|cjs|vue|svelte|astro)$/i.test(relative) || /^(?:package\.json|\.npmrc|\.nvmrc|\.gitignore)$/.test(path.basename(relative));
        files.push({ path: relative, contents: isText ? data.toString("utf8") : data.toString("base64"), encoding: isText ? "utf8" : "base64" });
      } catch { /* Ignore missing or unsafe entries; never follow symlinks. */ }
    }
    if (!files.some((file) => file.path === "package.json")) {
      return Response.json({ error: "This runtime currently requires a root-level package.json." }, { status: 422 });
    }
    return Response.json({ files, totalBytes: total, excluded: ["environment files and private keys", "node_modules", ".git", generated build folders"] }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Project not found." }, { status: 404 });
  }
}
