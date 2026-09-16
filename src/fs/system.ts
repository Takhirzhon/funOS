import { files } from "virtual:portfolio";
import type { FsEntry } from "../store/fsStore";
import { errorDialog } from "../store/dialogStore";
import { HOME } from "./seed";
import { ancestors, basename, isInside, join, normalize } from "./path";

/* The system layer: files that are part of the machine rather than of the
 * visitor's copy of it.
 *
 * public/portfolio/ is compiled into a manifest (portfolio.plugin.ts) and laid
 * over whatever IndexedDB holds, on every load. The entries never reach the
 * database and cannot be deleted, renamed or overwritten - which is exactly
 * how Windows treats a file it owns, down to the wording of the refusal.
 *
 * Protection is by path, not by a flag on the entry. A copy of CV.pdf dragged
 * into My Documents is the visitor's file: it still points at the same URL,
 * and they can throw it away like anything else.
 */

const toVfs = (rel: string) => join(HOME, rel);

/** Every path the manifest owns - files, and the folders that hold them. */
const SYSTEM_PATHS = new Set<string>();
for (const file of files) {
  for (const p of ancestors(toVfs(file.path))) {
    if (isInside(HOME, p)) SYSTEM_PATHS.add(p);
  }
}

/** A file the manifest ships, or a folder that exists because one is in it. */
export const isSystemPath = (path: string): boolean => SYSTEM_PATHS.has(normalize(path));

/** True when `path` is a system path or has one anywhere underneath it - the
 *  test for anything recursive: delete, move, rename. */
export function containsSystemPath(path: string): boolean {
  const p = normalize(path);
  if (SYSTEM_PATHS.has(p)) return true;
  for (const s of SYSTEM_PATHS) if (isInside(p, s)) return true;
  return false;
}

/** Whether these paths, or a folder around them, are system-owned: the
 *  pre-flight for Cut, Delete and Rename, so the refusal comes before the
 *  question rather than after it. */
export const firstSystemPath = (paths: string[]): string | undefined =>
  paths.find(containsSystemPath);

const ACTIONS = {
  delete: "Deleting",
  rename: "Renaming",
  move: "Moving",
  save: "Saving",
} as const;

/* XP's exact text. It was the error for every attempt to touch a system file,
 * and anyone who tried to clean up C:\WINDOWS once has read it. */
export const accessDenied = (action: keyof typeof ACTIONS, path: string): Promise<void> =>
  errorDialog(
    `Error ${ACTIONS[action]} File or Folder`,
    `Cannot ${action} ${basename(path)}: Access is denied.\n\nMake sure the disk is not full or write-protected and that the file is not currently in use.`
  );

/* The overlay, built once. Folders first, so that a manifest with only
 * "My Documents/My Videos/clip.mp4" in it still produces My Videos. Folders
 * that the seed also creates are simply overwritten with an identical entry.
 */
export function systemOverlay(): Record<string, FsEntry> {
  const out: Record<string, FsEntry> = {};
  const now = Date.now();

  for (const p of SYSTEM_PATHS) {
    out[p] = { path: p, kind: "dir", content: "", created: now, modified: now };
  }
  for (const file of files) {
    const path = toVfs(file.path);
    out[path] = {
      path,
      kind: "file",
      content: file.content ?? "",
      mime: file.mime,
      url: file.url,
      thumb: file.thumb,
      size: file.size,
      created: file.modified,
      modified: file.modified,
    };
  }
  return out;
}
