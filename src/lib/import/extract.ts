import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import yauzl from "yauzl";
import { ARCHIVE_LIMITS, normalizeArchivePath } from "@/lib/import/archive";

const fromBuffer = promisify(yauzl.fromBuffer);

export async function extractZipToDirectory(bytes: Buffer, destination: string): Promise<string[]> {
  const root = path.resolve(destination);
  await mkdir(root, { recursive: true, mode: 0o700 });
  const zip = await fromBuffer(bytes, {
    lazyEntries: true,
    decodeStrings: true,
    strictFileNames: true,
    validateEntrySizes: true,
  });

  const extracted: string[] = [];
  const seen = new Set<string>();
  let total = 0;
  let count = 0;

  try {
    await new Promise<void>((resolve, reject) => {
      let finished = false;
      const fail = (error: Error) => {
        if (finished) return;
        finished = true;
        zip.close();
        reject(error);
      };

      zip.on("error", fail);
      zip.on("end", () => {
        if (!finished) {
          finished = true;
          resolve();
        }
      });

      zip.on("entry", (entry) => {
        void (async () => {
          const relative = normalizeArchivePath(entry.fileName);
          const collisionKey = relative.toLocaleLowerCase("en-US");
          if (seen.has(collisionKey)) throw new Error("Archive contains duplicate or case-colliding paths.");
          seen.add(collisionKey);
          count += 1;
          if (count > ARCHIVE_LIMITS.maxEntries) throw new Error("Archive contains too many entries.");

          const unixMode = (entry.externalFileAttributes >>> 16) & 0xffff;
          const fileType = unixMode & 0o170000;
          if (fileType === 0o120000) throw new Error("Symbolic links are not supported in project archives.");
          if (fileType !== 0 && fileType !== 0o100000 && fileType !== 0o040000) {
            throw new Error("Archive contains an unsupported special file.");
          }

          const target = path.resolve(root, relative);
          if (!target.startsWith(root + path.sep) && target !== root) {
            throw new Error("Archive path escapes the project directory.");
          }

          total += entry.uncompressedSize;
          if (total > ARCHIVE_LIMITS.maxExpandedBytes) throw new Error("Archive exceeds the expanded-size limit.");

          if (entry.fileName.endsWith("/")) {
            await mkdir(target, { recursive: true, mode: 0o700 });
          } else {
            if (entry.uncompressedSize > ARCHIVE_LIMITS.maxEntryBytes) {
              throw new Error("An archive entry exceeds the per-file size limit.");
            }
            await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
            const readStream = await new Promise<NodeJS.ReadableStream>((res, rej) => {
              zip.openReadStream(entry, (error, stream) => error ? rej(error) : res(stream));
            });
            await pipeline(readStream, createWriteStream(target, { flags: "wx", mode: 0o600 }));
            extracted.push(relative);
          }
          zip.readEntry();
        })().catch((error: unknown) => fail(error instanceof Error ? error : new Error("ZIP extraction failed.")));
      });
      zip.readEntry();
    });
  } catch (error) {
    // Never leave a partial project that could be mistaken for a successful import.
    const { rm } = await import("node:fs/promises");
    await rm(root, { recursive: true, force: true });
    throw error;
  }
  return extracted;
}
