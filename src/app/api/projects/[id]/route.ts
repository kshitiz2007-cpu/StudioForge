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
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    if (manifest.id !== id) return Response.json({ error: "Project not found." }, { status: 404 });
    return Response.json({ project: manifest });
  } catch {
    return Response.json({ error: "Project not found." }, { status: 404 });
  }
}
