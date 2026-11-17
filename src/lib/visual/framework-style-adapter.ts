import { lstat, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import postcss from "postcss";

type Manifest = { kind: string; files: { path: string; size: number; isDirectory?: boolean }[] };
type EditInput = { selector: string; tagName?: string; classNames?: string[]; property: string; value: string };
type SourceChange = { path: string; content: string; matchedSelector: string };

const STYLE_EXTENSIONS = new Set([".css", ".pcss"]);
const COMPONENT_EXTENSIONS: Record<string, Set<string>> = {
  vue: new Set([".vue"]),
  svelte: new Set([".svelte"]),
};
const ALLOWED_PROPERTIES = new Set([
  "color","background-color","background-image","font-family","font-size","font-weight","line-height","letter-spacing","text-align",
  "width","height","min-width","max-width","min-height","max-height","margin","margin-top","margin-right","margin-bottom","margin-left",
  "padding","padding-top","padding-right","padding-bottom","padding-left","gap","row-gap","column-gap","display","flex-direction",
  "flex-wrap","justify-content","align-items","align-content","border","border-width","border-style","border-color","border-radius",
  "box-shadow","opacity"
]);

function validateDeclaration(property: string, value: string) {
  if (!ALLOWED_PROPERTIES.has(property)) throw new Error("This style property is not supported.");
  if (!value || value.length > 500 || /[{}]/.test(value)) throw new Error("Invalid CSS value.");
  const parsed = postcss.parse(`x{ ${property}: ${value}; }`);
  const declarations: { prop: string; value: string }[] = [];
  parsed.walkDecls((decl) => declarations.push({ prop: decl.prop, value: decl.value }));
  const normalized = declarations[0]?.value.toLowerCase() ?? "";
  if (declarations.length !== 1 || declarations[0].prop !== property || /url\s*\(|expression\s*\(|javascript:|behavior\s*:|-moz-binding/i.test(normalized)) {
    throw new Error("Unsafe CSS value.");
  }
  return declarations[0].value;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function selectorMatches(selectorText: string, input: EditInput) {
  const selectors = selectorText.split(",").map((part) => part.trim());
  const candidates = [
    ...((input.classNames ?? []).filter((name) => /^[\w-]+$/.test(name)).map((name) => `.${name}`)),
    ...(input.selector.startsWith("#") && /^#[\w-]+$/.test(input.selector) ? [input.selector] : []),
  ];
  if (!candidates.length) return selectors.includes(input.selector);
  return selectors.some((selector) => candidates.some((candidate) => {
    if (candidate.startsWith(".")) return new RegExp(`\\.${escapeRegExp(candidate.slice(1))}(?![\\w-])`).test(selector);
    return selector.split(/[\s>+~:[\]]/)[0] === candidate;
  }));
}

function updateCss(source: string, input: EditInput, value: string) {
  const root = postcss.parse(source);
  let matched: postcss.Rule | undefined;
  root.walkRules((rule) => {
    if (!matched && selectorMatches(rule.selector, input)) matched = rule;
  });
  if (!matched) return null;
  matched.walkDecls(input.property, (decl) => decl.remove());
  matched.append(postcss.decl({ prop: input.property, value, important: true }));
  return { content: root.toString(), matchedSelector: matched.selector };
}

function updateComponentStyles(source: string, input: EditInput, value: string) {
  const pattern = /<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source))) {
    const updated = updateCss(match[1], input, value);
    if (updated) {
      const start = match.index + match[0].indexOf(match[1]);
      return {
        content: source.slice(0, start) + updated.content + source.slice(start + match[1].length),
        matchedSelector: updated.matchedSelector,
      };
    }
  }
  return null;
}

async function safeRead(root: string, relative: string) {
  const normalized = relative.replace(/\\/g, "/");
  if (!normalized || normalized.startsWith("/") || normalized.split("/").some((part) => !part || part === "." || part === "..")) return null;
  const base = path.resolve(root);
  const target = path.resolve(base, normalized);
  if (!target.startsWith(base + path.sep)) return null;
  try {
    const info = await lstat(target);
    const rootReal = await realpath(root);
    const targetReal = await realpath(target);
    if (!info.isFile() || info.isSymbolicLink() || !targetReal.startsWith(rootReal + path.sep) || info.size > 1024 * 1024) return null;
    return { target, content: await readFile(target, "utf8") };
  } catch {
    return null;
  }
}

export async function applyFrameworkStyleEdit(filesRoot: string, manifest: Manifest, input: EditInput): Promise<SourceChange> {
  const value = validateDeclaration(input.property, input.value);
  const kind = manifest.kind;
  const vueOrSvelte = COMPONENT_EXTENSIONS[kind];
  const candidates = manifest.files
    .filter((file) => !file.isDirectory)
    .filter((file) => {
      const ext = path.extname(file.path).toLowerCase();
      return STYLE_EXTENSIONS.has(ext) || Boolean(vueOrSvelte?.has(ext));
    })
    .sort((a, b) => {
      const aComponent = /\.(vue|svelte)$/.test(a.path) ? 0 : 1;
      const bComponent = /\.(vue|svelte)$/.test(b.path) ? 0 : 1;
      return aComponent - bComponent || a.path.localeCompare(b.path);
    });

  for (const file of candidates) {
    const loaded = await safeRead(filesRoot, file.path);
    if (!loaded) continue;
    const isComponent = Boolean(vueOrSvelte?.has(path.extname(file.path).toLowerCase()));
    const updated = isComponent
      ? updateComponentStyles(loaded.content, input, value)
      : updateCss(loaded.content, input, value);
    if (!updated) continue;
    await writeFile(loaded.target, updated.content, { encoding: "utf8", mode: 0o600 });
    return { path: file.path, content: updated.content, matchedSelector: updated.matchedSelector };
  }

  const frameworkLabel: Record<string, string> = {
    react: "React", next: "Next.js", vue: "Vue", svelte: "Svelte", angular: "Angular",
    static: "static HTML/CSS", vite: "Vite"
  };
  const label = frameworkLabel[kind] ?? "this project";
  throw new Error(`No existing source stylesheet rule matched this element in ${label}. Add a stable class or ID and a matching rule first. No generated override was created.`);
}
