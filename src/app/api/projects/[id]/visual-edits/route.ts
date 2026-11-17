import { lstat, readFile, realpath, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import postcss from "postcss";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_PROPERTIES = new Set([
  "color","background-color","background-image","font-family","font-size","font-weight","line-height","letter-spacing","text-align",
  "width","height","min-width","max-width","min-height","max-height","margin","margin-top","margin-right","margin-bottom","margin-left",
  "padding","padding-top","padding-right","padding-bottom","padding-left","gap","row-gap","column-gap","display","flex-direction",
  "flex-wrap","justify-content","align-items","align-content","border","border-width","border-style","border-color","border-radius",
  "box-shadow","opacity"
]);

function projectPath(root: string, relative: string) {
  const normalized = relative.replace(/\\/g, "/");
  if (!normalized || normalized.startsWith("/") || normalized.split("/").some((part) => !part || part === "." || part === "..")) throw new Error("Invalid path.");
  const base = path.resolve(root);
  const target = path.resolve(base, normalized);
  if (!target.startsWith(base + path.sep)) throw new Error("Invalid path.");
  return target;
}

function cssDeclaration(property: string, value: string) {
  if (!ALLOWED_PROPERTIES.has(property)) throw new Error("This style property is not supported yet.");
  if (!value || value.length > 500 || /[{}]/.test(value)) throw new Error("Invalid CSS value.");
  const parsed = postcss.parse(`x{ ${property}: ${value}; }`);
  const decls: { prop: string; value: string }[] = [];
  parsed.walkDecls((decl) => decls.push({ prop: decl.prop, value: decl.value }));
  if (decls.length !== 1 || decls[0].prop !== property || /url\\s*\\(|expression\\s*\\(|javascript:/i.test(decls[0].value)) throw new Error("Unsafe CSS value.");
  return decls[0].value;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!ID_PATTERN.test(id)) return Response.json({ error: "Project not found." }, { status: 404 });
  if (process.env.NODE_ENV === "production" && process.env.STUDIOFORGE_ENABLE_UNAUTHENTICATED_LOCAL_IMPORT !== "true") {
    return Response.json({ error: "Local visual editing is disabled in production until authentication and ownership checks are configured." }, { status: 403 });
  }
  let payload: { selector?: unknown; property?: unknown; value?: unknown };
  try { payload = await request.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  if (typeof payload.selector !== "string" || typeof payload.property !== "string" || typeof payload.value !== "string") {
    return Response.json({ error: "A selector, property and value are required." }, { status: 400 });
  }
  if (payload.selector.length > 500 || !/^[a-zA-Z0-9_#.[\]:> +"'()=-]+$/.test(payload.selector)) {
    return Response.json({ error: "The selected element does not have a safe, persistent CSS selector." }, { status: 400 });
  }
  let value: string;
  try { value = cssDeclaration(payload.property, payload.value); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Invalid style." }, { status: 400 }); }

  const projectDir = path.join(process.cwd(), ".studioforge", "projects", id);
  try {
    const manifestPath = path.join(projectDir, "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as { id: string; entrypoint: string | null; files: { path: string; size: number; isDirectory: boolean }[] };
    if (manifest.id !== id || !manifest.entrypoint) return Response.json({ error: "Static HTML project entrypoint required." }, { status: 400 });
    const filesRoot = path.join(projectDir, "files");
    const htmlTarget = projectPath(filesRoot, manifest.entrypoint);
    const htmlInfo = await lstat(htmlTarget);
    const rootReal = await realpath(filesRoot);
    const htmlReal = await realpath(htmlTarget);
    if (!htmlInfo.isFile() || htmlInfo.isSymbolicLink() || !htmlReal.startsWith(rootReal + path.sep) || htmlInfo.size > 1024 * 1024) {
      return Response.json({ error: "Unsafe or oversized HTML entrypoint." }, { status: 400 });
    }
    const html = await readFile(htmlTarget, "utf8");
    const htmlDir = path.posix.dirname(manifest.entrypoint);
    const cssRelative = path.posix.join(htmlDir === "." ? "" : htmlDir, "studioforge-overrides.css");
    const cssTarget = projectPath(filesRoot, cssRelative);
    let existingCss = "";
    try {
      const cssInfo = await lstat(cssTarget);
      const cssReal = await realpath(cssTarget);
      if (!cssInfo.isFile() || cssInfo.isSymbolicLink() || !cssReal.startsWith(rootReal + path.sep) || cssInfo.size > 512 * 1024) {
        return Response.json({ error: "Unsafe visual override stylesheet." }, { status: 400 });
      }
      existingCss = await readFile(cssTarget, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }

    const parsedCss = postcss.parse(existingCss || "/* StudioForge visual overrides */");
    let rule = parsedCss.nodes.find((node) => node.type === "rule" && node.selector === payload.selector) as postcss.Rule | undefined;
    if (!rule) {
      rule = postcss.rule({ selector: payload.selector });
      parsedCss.append(rule);
    }
    rule.walkDecls(payload.property, (decl) => decl.remove());
    rule.append(postcss.decl({ prop: payload.property, value, important: true }));
    const nextCss = parsedCss.toString();
    if (Buffer.byteLength(nextCss, "utf8") > 512 * 1024) return Response.json({ error: "Visual overrides stylesheet reached its 512 KB limit." }, { status: 413 });
    await writeFile(cssTarget, nextCss, { encoding: "utf8", mode: 0o600 });

    const href = path.posix.basename(cssRelative);
    const link = `<link rel="stylesheet" href="${href}" data-studioforge-overrides="true">`;
    const nextHtml = /data-studioforge-overrides=["']true["']/.test(html)
      ? html
      : html.replace(/<\\/head>/i, `${link}</head>`);
    if (nextHtml === html && !/data-studioforge-overrides=["']true["']/.test(html)) {
      return Response.json({ error: "Could not safely attach the visual stylesheet to the HTML entrypoint." }, { status: 422 });
    }
    await writeFile(htmlTarget, nextHtml, { encoding: "utf8", mode: 0o600 });
    const cssEntry = manifest.files.find((file) => file.path === cssRelative);
    if (cssEntry) cssEntry.size = Buffer.byteLength(nextCss, "utf8");
    else manifest.files.push({ path: cssRelative, size: Buffer.byteLength(nextCss, "utf8"), isDirectory: false });
    const htmlEntry = manifest.files.find((file) => file.path === manifest.entrypoint);
    if (htmlEntry) htmlEntry.size = Buffer.byteLength(nextHtml, "utf8");
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), { encoding: "utf8", mode: 0o600 });
    return Response.json({ saved: true, selector: payload.selector, property: payload.property, value, stylesheet: cssRelative, size: (await stat(cssTarget)).size });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not save visual style." }, { status: 500 });
  }
}
