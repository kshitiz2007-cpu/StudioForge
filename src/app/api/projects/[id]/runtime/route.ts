import { readFile } from "node:fs/promises";
import path from "node:path";
import { getRuntimeProvider } from "@/lib/runtime/provider";

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
    const provider = getRuntimeProvider();
    return Response.json({
      projectId: id,
      projectKind: manifest.kind,
      projectName: manifest.name,
      status: provider ? "available" : "not_configured",
      provider: provider?.name ?? null,
      canStart: Boolean(provider),
      message: provider ? "Runtime provider is configured." : "No isolated runtime provider is configured. Imported project code will not be executed.",
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
  const provider = getRuntimeProvider();
  if (!provider) {
    return Response.json({
      error: "Runtime provider is not configured. No project commands were executed.",
      status: "not_configured",
      required: ["An isolated runtime provider", "Workspace CPU/memory/disk/time limits", "Network egress policy", "Dedicated preview origin", "Workspace cleanup and lifecycle monitoring"],
    }, { status: 503 });
  }
  return Response.json({ error: "The configured provider does not yet expose a project start workflow." }, { status: 501 });
}
