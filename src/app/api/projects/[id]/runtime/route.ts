import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!ID_PATTERN.test(id)) return Response.json({ error: "Project not found." }, { status: 404 });
  try {
    const manifestPath = path.join(process.cwd(), ".studioforge", "projects", id, "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as { id: string; kind: string; name: string };
    if (manifest.id !== id) return Response.json({ error: "Project not found." }, { status: 404 });
    return Response.json({
      projectId: id,
      projectKind: manifest.kind,
      projectName: manifest.name,
      status: "available",
      provider: "WebContainers (browser sandbox)",
      canStart: false,
      message: "Use the Live Runtime Engine panel to start this project in your browser tab. This is not a remote microVM.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Project not found." }, { status: 404 });
  }
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!ID_PATTERN.test(id)) return Response.json({ error: "Project not found." }, { status: 404 });
  if (process.env.NODE_ENV === "production" && process.env.STUDIOFORGE_ENABLE_UNAUTHENTICATED_LOCAL_IMPORT !== "true") {
    return Response.json({ error: "Runtime actions require authenticated project ownership before production use." }, { status: 403 });
  }
  try {
    const manifestPath = path.join(process.cwd(), ".studioforge", "projects", id, "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as { id: string };
    if (manifest.id !== id) return Response.json({ error: "Project not found." }, { status: 404 });
  } catch {
    return Response.json({ error: "Project not found." }, { status: 404 });
  }
  return Response.json({ error: "Start the browser runtime from the Live Runtime Engine panel. Server-side execution is intentionally unavailable." }, { status: 410 });
}
