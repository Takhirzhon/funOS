import { useFsStore } from "../store/fsStore";
import { extname } from "./path";

/* Bringing a file in from the host operating system.
 *
 * Shared by the desktop and by Explorer, because "what counts as text" and
 * "how big is too big" are decisions that must not differ between the two
 * places a file can be dropped.
 */

/* A file is text if the browser says so, or if its extension says so. The
 * extension check is not redundant: the browser guesses the type from the
 * extension too, and gets nothing at all for .ts, .md, .log and half of what
 * anyone would actually drag in.
 */
const TEXT_EXTENSIONS = new Set([
  ".txt", ".md", ".markdown", ".json", ".js", ".jsx", ".ts", ".tsx", ".css",
  ".html", ".htm", ".xml", ".svg", ".csv", ".tsv", ".log", ".ini", ".cfg",
  ".conf", ".bat", ".cmd", ".sh", ".yml", ".yaml", ".toml", ".sql", ".py",
]);

export function isTextFile(file: File): boolean {
  if (file.type.startsWith("text/")) return true;
  if (file.type === "application/json" || file.type === "application/xml") return true;
  return TEXT_EXTENSIONS.has(extname(file.name));
}

/* The whole entry map is serialized to IndexedDB on every write, so one large
 * file makes every later save slower for as long as it is there. These are the
 * limits that keep that invisible rather than a mystery.
 */
const MAX_TEXT = 1_000_000;
const MAX_BINARY = 4_000_000;

/** Returns an error message, or null if the file was written. */
export async function importFile(file: File, folder: string): Promise<string | null> {
  const { uniquePath, writeFile, writeBinary } = useFsStore.getState();
  const text = isTextFile(file);
  const limit = text ? MAX_TEXT : MAX_BINARY;

  if (file.size > limit) {
    return `${file.name} is ${(file.size / 1_000_000).toFixed(1)} MB. The limit here is ${limit / 1_000_000} MB.`;
  }

  const target = uniquePath(folder, file.name);

  if (text) {
    return writeFile(target, await file.text()) ? null : `${file.name} could not be copied here.`;
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = file.type || "application/octet-stream";
  return writeBinary(target, bytes, mime) ? null : `${file.name} could not be copied here.`;
}

/** Import several, reporting the first failure rather than one dialog each. */
export async function importFiles(files: FileList | File[], folder: string): Promise<string | null> {
  let firstError: string | null = null;
  for (const file of Array.from(files)) {
    const error = await importFile(file, folder);
    if (error && !firstError) firstError = error;
  }
  return firstError;
}
