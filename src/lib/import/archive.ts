import { z } from "zod";

export const ARCHIVE_LIMITS = {
  maxEntries: 2_000,
  maxExpandedBytes: 100 * 1024 * 1024,
  maxEntryBytes: 20 * 1024 * 1024,
  maxPathLength: 240,
} as const;

const ArchiveEntrySchema = z.object({
  name: z.string().min(1).max(ARCHIVE_LIMITS.maxPathLength),
  size: z.number().int().nonnegative().max(ARCHIVE_LIMITS.maxEntryBytes),
  compressedSize: z.number().int().nonnegative(),
  isDirectory: z.boolean().default(false),
  isSymlink: z.boolean().default(false),
});

export type ArchiveEntry = z.infer<typeof ArchiveEntrySchema>;
export type FrameworkKind = "static" | "vite" | "next" | "react" | "vue" | "svelte" | "angular" | "unknown";

export type ArchiveInspection = {
  entries: ArchiveEntry[];
  totalExpandedBytes: number;
  framework: FrameworkKind;
  entrypoint: string | null;
  warnings: string[];
};

export class ArchiveValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArchiveValidationError";
  }
}

/** Normalize and validate a ZIP entry name before it is ever written to disk. */
export function normalizeArchivePath(input: string): string {
  if (!input || input.length > ARCHIVE_LIMITS.maxPathLength) {
    throw new ArchiveValidationError("Archive contains an empty or excessively long path.");
  }
  const slashed = input.replace(/\\/g, "/");
  if (slashed.startsWith("/") || /^[a-zA-Z]:/.test(slashed) || slashed.startsWith("//")) {
    throw new ArchiveValidationError(`Absolute archive path rejected: ${input}`);
  }
  const segments = slashed.split("/");
  if (segments.some((segment) => segment === ".." || segment === "." || segment.includes("\0"))) {
    throw new ArchiveValidationError(`Unsafe archive path rejected: ${input}`);
  }
  const normalized = segments.filter(Boolean).join("/");
  if (!normalized) throw new ArchiveValidationError("Archive entry has no usable path.");
  return normalized;
}

export function detectFramework(paths: string[], packageJson?: unknown): FrameworkKind {
  const packageData = packageJson && typeof packageJson === "object"
    ? packageJson as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
    : {};
  const deps = { ...packageData.dependencies, ...packageData.devDependencies };
  if (deps.next || paths.some((p) => p.endsWith("next.config.js") || p.endsWith("next.config.ts"))) return "next";
  if (deps["@angular/core"] || paths.some((p) => p.endsWith("angular.json"))) return "angular";
  if (deps.vue || paths.some((p) => p.endsWith("vue.config.js"))) return "vue";
  if (deps.svelte || paths.some((p) => p.endsWith("svelte.config.js"))) return "svelte";
  if (deps.vite || paths.some((p) => p.endsWith("vite.config.ts") || p.endsWith("vite.config.js"))) return "vite";
  if (deps.react || paths.some((p) => p.endsWith(".jsx") || p.endsWith(".tsx"))) return "react";
  if (paths.some((p) => p === "index.html" || p.endsWith("/index.html"))) return "static";
  return "unknown";
}

export function inspectArchiveEntries(input: unknown[]): ArchiveInspection {
  if (input.length === 0) throw new ArchiveValidationError("The ZIP archive is empty.");
  if (input.length > ARCHIVE_LIMITS.maxEntries) throw new ArchiveValidationError("Archive contains too many entries.");

  const seen = new Set<string>();
  const entries: ArchiveEntry[] = [];
  let totalExpandedBytes = 0;

  for (const raw of input) {
    const parsed = ArchiveEntrySchema.safeParse(raw);
    if (!parsed.success) throw new ArchiveValidationError("Archive contains an invalid or oversized entry.");
    const entry = parsed.data;
    const path = normalizeArchivePath(entry.name);
    if (seen.has(path)) throw new ArchiveValidationError(`Duplicate archive path rejected: ${path}`);
    seen.add(path);
    if (entry.isSymlink) throw new ArchiveValidationError(`Symbolic link rejected: ${path}`);
    if (entry.size > entry.compressedSize * 1_000 && entry.size > 1_000_000) {
      throw new ArchiveValidationError(`Suspicious compression ratio rejected: ${path}`);
    }
    totalExpandedBytes += entry.size;
    if (totalExpandedBytes > ARCHIVE_LIMITS.maxExpandedBytes) {
      throw new ArchiveValidationError("Archive exceeds the total expanded-size limit.");
    }
    entries.push({ ...entry, name: path });
  }

  const paths = entries.filter((entry) => !entry.isDirectory).map((entry) => entry.name);
  const warnings: string[] = [];
  if (paths.some((path) => path.split("/").some((part) => part.toLowerCase() === "node_modules"))) {
    warnings.push("Archive includes node_modules; dependency folders are usually best excluded.");
  }
  if (paths.some((path) => path.toLowerCase().endsWith(".env"))) {
    warnings.push("Archive contains an environment file. Review it for secrets before sharing or running.");
  }
  const packageEntry = entries.find((entry) => entry.name === "package.json" && !entry.isDirectory);
  return {
    entries,
    totalExpandedBytes,
    framework: detectFramework(paths, packageEntry ? undefined : undefined),
    entrypoint: paths.includes("index.html") ? "index.html" : paths.find((path) => path.endsWith("/index.html")) ?? null,
    warnings,
  };
}
