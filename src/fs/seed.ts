import type { FsEntry } from "../store/fsStore";
import { DRIVE } from "./path";

/* The file system a fresh install comes with.
 *
 * Only ever used when IndexedDB has nothing stored - a returning visitor gets
 * their own tree back, including the parts of this one they deleted. That is
 * why hydration replaces the map wholesale instead of merging: merging would
 * resurrect every seeded file the moment it was thrown away.
 *
 * The layout is XP's, down to "Documents and Settings" rather than "Users" -
 * the rename happened in Vista, and getting it wrong is the kind of detail
 * someone who used this machine daily notices immediately.
 */

const USER = `${DRIVE}/Documents and Settings/User`;

export const HOME = USER;
export const DESKTOP_DIR = `${USER}/Desktop`;
export const MY_DOCUMENTS = `${USER}/My Documents`;

const DIRS = [
  DRIVE,
  `${DRIVE}/Documents and Settings`,
  USER,
  DESKTOP_DIR,
  MY_DOCUMENTS,
  `${MY_DOCUMENTS}/My Pictures`,
  `${MY_DOCUMENTS}/My Music`,
  `${DRIVE}/Program Files`,
  `${DRIVE}/Program Files/funOS`,
  `${DRIVE}/WINDOWS`,
  `${DRIVE}/WINDOWS/system32`,
  `${DRIVE}/WINDOWS/Web/Wallpaper`,
];

const FILES: { path: string; content: string }[] = [
  {
    path: `${MY_DOCUMENTS}/readme.txt`,
    content: [
      "funOS",
      "=====",
      "",
      "A Windows XP desktop that runs in a browser tab.",
      "",
      "This file lives in a virtual file system backed by IndexedDB, so it",
      "survives a reload - edit it, save it, and come back tomorrow.",
      "",
      "Try: right-click the desktop, drag the icons around, open two windows",
      "and watch the inactive title bar go grey.",
    ].join("\r\n"),
  },
  {
    path: `${DESKTOP_DIR}/Welcome.txt`,
    content: [
      "Double-click a .txt file anywhere and it opens in Notepad.",
      "",
      "Files you create in My Documents stay there. Files you delete are gone",
      "for good - there is no Recycle Bin behind the Recycle Bin yet.",
    ].join("\r\n"),
  },
  {
    path: `${DRIVE}/WINDOWS/system32/hosts`,
    content: ["127.0.0.1       localhost", "::1             localhost"].join("\r\n"),
  },
];

export function buildSeed(): Record<string, FsEntry> {
  const now = Date.now();
  const entries: Record<string, FsEntry> = {};

  for (const path of DIRS) {
    entries[path] = { path, kind: "dir", content: "", created: now, modified: now };
  }
  for (const { path, content } of FILES) {
    entries[path] = { path, kind: "file", content, created: now, modified: now };
  }

  return entries;
}
