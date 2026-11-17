import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { ArchiveInspection } from "@/lib/import/archive";
import { extractZipToDirectory } from "@/lib/import/extract";

const STORAGE_ROOT = path.join(process.cwd(), ".studioforge", "projects");

export async function persistImportedArchive(input: {
  name: string;
  bytes: Buffer;
  inspection: ArchiveInspection;
}) {
  const id = randomUUID();
  const projectDir = path.join(STORAGE_ROOT, id);
  await mkdir(projectDir, { recursive: true, mode: 0o700 });
  await writeFile(path.join(projectDir, "source.zip"), input.bytes, { flag: "wx", mode: 0o600 });
  const extractedFiles = await extractZipToDirectory(input.bytes, path.join(projectDir, "files"));
  const manifest = {
    id,
    name: input.name.replace(/\.zip$/i, "").slice(0, 80) || "Imported project",
    kind: input.inspection.framework,
    entrypoint: input.inspection.entrypoint,
    files: input.inspection.entries.filter(({ isDirectory }) => !isDirectory).map(({ name, size, isDirectory }) => ({
      path: name,
      size,
      isDirectory,
    })),
    extractedFiles,
    totalExpandedBytes: input.inspection.totalExpandedBytes,
    warnings: input.inspection.warnings,
    importedAt: new Date().toISOString(),
    archivePath: "source.zip",
    executionStatus: "not_started",
  };
  await writeFile(path.join(projectDir, "manifest.json"), JSON.stringify(manifest, null, 2), {
    flag: "wx",
    mode: 0o600,
  });
  return manifest;
}
