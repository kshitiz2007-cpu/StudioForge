import { randomUUID } from "node:crypto";
import yauzl from "yauzl";
import { promisify } from "node:util";
import { ARCHIVE_LIMITS, inspectArchiveEntries, type ArchiveEntry } from "@/lib/import/archive";
import { persistImportedArchive } from "@/lib/import/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const fromBuffer = promisify(yauzl.fromBuffer);
const openReadStream = promisify(yauzl.ZipFile.prototype.openReadStream);

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function inspectZip(buffer: Buffer) {
  const zip = await fromBuffer(buffer, { lazyEntries: true, decodeStrings: true, strictFileNames: true });
  return new Promise<ArchiveEntry[]>((resolve, reject) => {
    const entries: ArchiveEntry[] = [];
    let expanded = 0;
    let settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      zip.close();
      reject(error);
    };
    zip.on("error", fail);
    zip.on("end", () => {
      if (!settled) {
        settled = true;
        resolve(entries);
      }
    });
    zip.on("entry", (entry) => {
      try {
        const isDirectory = entry.fileName.endsWith("/");
        const unixMode = (entry.externalFileAttributes >>> 16) & 0xffff;
        const isSymlink = (unixMode & 0o170000) === 0o120000;
        const item: ArchiveEntry = {
          name: entry.fileName,
          size: entry.uncompressedSize,
          compressedSize: entry.compressedSize,
          isDirectory,
          isSymlink,
        };
        // Validate each entry before accepting more archive metadata.
        const checked = inspectArchiveEntries([...entries, item]);
        entries.push(item);
        expanded = checked.totalExpandedBytes;
        if (entries.length >= ARCHIVE_LIMITS.maxEntries) {
          fail(new Error("Archive contains too many entries."));
          return;
        }
        if (expanded > ARCHIVE_LIMITS.maxExpandedBytes) {
          fail(new Error("Archive exceeds the expanded-size limit."));
          return;
        }
        zip.readEntry();
      } catch (error) {
        fail(error instanceof Error ? error : new Error("Invalid ZIP archive."));
      }
    });
    zip.readEntry();
  });
}

export async function POST(request: Request) {
  // This first-pass filesystem importer is for local development only; production needs auth + owner-scoped storage.
  if (process.env.NODE_ENV === "production" && process.env.STUDIOFORGE_ENABLE_UNAUTHENTICATED_LOCAL_IMPORT !== "true") {
    return jsonError("Local import is disabled in production until authentication and project ownership are configured.", 503);
  }
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return jsonError("Choose a ZIP file to import.", 400);
    if (!file.name.toLowerCase().endsWith(".zip")) return jsonError("Only .zip archives are supported.", 415);
    if (file.size <= 0) return jsonError("The selected ZIP file is empty.", 400);
    if (file.size > MAX_UPLOAD_BYTES) return jsonError("ZIP upload exceeds the 25 MB limit.", 413);

    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
      return jsonError("The uploaded file does not have a valid ZIP signature.", 415);
    }

    const entries = await inspectZip(bytes);
    const inspection = inspectArchiveEntries(entries);
    const project = await persistImportedArchive({
      name: file.name.replace(/[\\/]/g, "_"),
      bytes,
      inspection,
    });
    return Response.json({ project }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not import this archive.";
    const safeMessage = message.length > 180 ? "The ZIP archive failed validation." : message;
    return jsonError(safeMessage, 400);
  }
}
