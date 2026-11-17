import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import sanitizeHtml from "sanitize-html";
import postcss from "postcss";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_HTML_BYTES = 1024 * 1024;
const MAX_CSS_BYTES = 512 * 1024;
const MAX_CSS_FILES = 12;

function resolveProjectPath(root: string, relative: string) {
  const clean = relative.replace(/\\/g, "/");
  if (!clean || clean.startsWith("/") || clean.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error("Invalid project asset path.");
  }
  const base = path.resolve(root);
  const target = path.resolve(base, clean);
  if (!target.startsWith(base + path.sep)) throw new Error("Invalid project asset path.");
  return target;
}

function safeCss(source: string) {
  const root = postcss.parse(source);
  root.walkAtRules((rule) => {
    if (["import", "namespace", "charset"].includes(rule.name.toLowerCase())) rule.remove();
  });
  root.walkDecls((decl) => {
    const value = decl.value.toLowerCase();
    if (value.includes("url(") || value.includes("expression(") || value.includes("javascript:") || decl.prop.toLowerCase() === "behavior") {
      decl.remove();
    }
  });
  return root.toString();
}

function collectLocalStylesheets(html: string, htmlPath: string) {
  const folder = path.posix.dirname(htmlPath);
  const hrefs = [...html.matchAll(/<link\\b[^>]*rel=["']?stylesheet["']?[^>]*href=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => match[1])
    .filter((href) => !/^(?:[a-z]+:|\/\/|#|data:)/i.test(href) && !href.includes("?") && !href.includes("#"));
  return [...new Set(hrefs.map((href) => path.posix.normalize(path.posix.join(folder === "." ? "" : folder, href))).filter((p) => p && p !== "." && !p.startsWith("../")))].slice(0, MAX_CSS_FILES);
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!ID_PATTERN.test(id)) return Response.json({ error: "Project not found." }, { status: 404 });

  const projectDir = path.join(process.cwd(), ".studioforge", "projects", id);
  try {
    const manifest = JSON.parse(await readFile(path.join(projectDir, "manifest.json"), "utf8")) as { id: string; entrypoint: string | null };
    const requestedSession = new URL(request.url).searchParams.get("session");
    const sessionId = requestedSession && /^[0-9a-f-]{36}$/i.test(requestedSession) ? requestedSession : randomUUID();
    if (manifest.id !== id || !manifest.entrypoint) return Response.json({ error: "No static HTML entrypoint is available." }, { status: 404 });

    const sourceRoot = path.join(projectDir, "files");
    const htmlPath = manifest.entrypoint;
    const htmlFile = resolveProjectPath(sourceRoot, htmlPath);
    const htmlInfo = await stat(htmlFile);
    if (!htmlInfo.isFile() || htmlInfo.size > MAX_HTML_BYTES) return Response.json({ error: "HTML entrypoint exceeds the preview limit." }, { status: 413 });
    const originalHtml = await readFile(htmlFile, "utf8");

    const styles: string[] = [];
    for (const stylesheet of collectLocalStylesheets(originalHtml, htmlPath)) {
      try {
        const cssFile = resolveProjectPath(sourceRoot, stylesheet);
        const info = await stat(cssFile);
        if (!info.isFile() || info.size > MAX_CSS_BYTES) continue;
        styles.push(safeCss(await readFile(cssFile, "utf8")));
      } catch {
        // Missing or invalid stylesheets are skipped; preview remains available.
      }
    }

    const safeMarkup = sanitizeHtml(originalHtml, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat([
        "img", "main", "header", "footer", "nav", "section", "article", "aside", "video", "audio", "source", "picture", "figure", "figcaption"
      ]),
      allowedAttributes: {
        "*": ["class", "id", "title", "role", "aria-label", "data-*"],
        a: ["href", "target", "rel"],
        img: ["src", "alt", "width", "height"],
        source: ["src", "type"],
        video: ["controls", "width", "height", "poster"],
        audio: ["controls"],
      },
      allowedSchemes: ["https", "http", "mailto", "tel", "data"],
      allowedSchemesByTag: { img: ["data"] },
      disallowedTagsMode: "discard",
      transformTags: {
        a: (_tagName, attribs) => ({ tagName: "a", attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer" } }),
      },
    });

    const document = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'self'; font-src 'none'; media-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'"><style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0;min-height:100%;}img{max-width:100%;height:auto}${styles.join("\\n")}</style></head><body>${safeMarkup}</body><script src="/preview-bridge.js?session=${encodeURIComponent(sessionId)}" defer></script></html>`;
    return new Response(document, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'self'; font-src 'none'; media-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'",
      },
    });
  } catch {
    return Response.json({ error: "Could not build a safe static preview for this project." }, { status: 404 });
  }
}
