import { create } from "zustand";
import { idbGet, idbSet } from "../fs/idb";
import { buildSeed } from "../fs/seed";
import {
  basename,
  dirname,
  extname,
  isDriveRoot,
  isInside,
  isValidName,
  join,
  normalize,
} from "../fs/path";

export type FsEntry = {
  /** Canonical path. Also the key in `entries` - stored twice on purpose, so an
   *  entry passed around on its own still knows where it lives. */
  path: string;
  kind: "dir" | "file";
  /** Empty for directories. Text only for now; binary arrives with Paint. */
  content: string;
  created: number;
  modified: number;
};

const STORAGE_KEY = "fs.entries";

/* A flat map rather than a tree.
 *
 * Listing a directory becomes a filter instead of a walk, which for a file
 * system this size is not a performance question at all - it is that every
 * operation stays a one-liner and there is no parent/child bookkeeping to get
 * out of step. Rename, move and recursive delete are the operations where a
 * tree of objects usually goes wrong, and here they are all just key rewrites.
 */
type FsStore = {
  entries: Record<string, FsEntry>;
  /** False until IndexedDB has been read. The seed is already usable meanwhile. */
  ready: boolean;

  get: (path: string) => FsEntry | undefined;
  exists: (path: string) => boolean;
  list: (dir: string) => FsEntry[];

  mkdir: (path: string) => boolean;
  writeFile: (path: string, content: string) => boolean;
  readFile: (path: string) => string | undefined;
  remove: (path: string) => boolean;
  rename: (path: string, nextName: string) => string | null;
  /** Move an entry into `targetDir`, keeping its name. Returns the new path. */
  move: (path: string, targetDir: string) => string | null;

  /** "New Folder", then "New Folder (2)" - the first free name in `dir`. */
  uniquePath: (dir: string, name: string) => string;
};

/* Writes are batched. Typing in Notepad fires one per keystroke, and each one
 * serializes the whole file system; without this the editor would stutter on a
 * large-ish file for no benefit, since nothing reads the database until the
 * next page load.
 */
let saveTimer: ReturnType<typeof setTimeout> | undefined;
const persist = (entries: Record<string, FsEntry>) => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void idbSet(STORAGE_KEY, entries), 250);
};

/* Exported as a pure function as well as a store method.
 *
 * A component that calls `useFsStore(s => s.list)(dir)` subscribes to the
 * *method*, which never changes, so it would never re-render when a file was
 * created. Subscribing to `entries` and calling this is the version that
 * actually updates.
 */
export function listEntries(entries: Record<string, FsEntry>, dir: string): FsEntry[] {
  const parent = normalize(dir);
  return Object.values(entries)
    .filter((e) => e.path !== parent && dirname(e.path) === parent)
    .sort(sortEntries);
}

/* Rename and move are the same operation with a different destination, so they
 * share one implementation. Doing them twice is how the two drift - one of them
 * remembers to carry the children along and the other does not.
 *
 * Carrying the children *is* the operation: slice the old prefix off every key
 * underneath and glue on the new one. That is correct rather than careful,
 * which is the whole argument for the map being flat.
 */
function relocate(
  set: (partial: { entries: Record<string, FsEntry> }) => void,
  get: () => { entries: Record<string, FsEntry> },
  from: string,
  to: string
): string | null {
  const { entries } = get();
  const entry = entries[from];
  if (!entry || isDriveRoot(from)) return null;
  if (to === from) return from;
  if (to in entries) return null;

  const now = Date.now();
  const next: Record<string, FsEntry> = {};
  for (const [key, value] of Object.entries(entries)) {
    if (key === from) {
      next[to] = { ...value, path: to, modified: now };
    } else if (isInside(from, key)) {
      const moved = to + key.slice(from.length);
      next[moved] = { ...value, path: moved };
    } else {
      next[key] = value;
    }
  }
  set({ entries: next });
  persist(next);
  return to;
}

const sortEntries = (a: FsEntry, b: FsEntry) => {
  /* Folders first, then by name - Explorer's default, and the reason a folder
   * never hides at the bottom of a long list of files. */
  if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
  return basename(a.path).localeCompare(basename(b.path), undefined, {
    numeric: true,
    sensitivity: "base",
  });
};

export const useFsStore = create<FsStore>((set, get) => ({
  entries: buildSeed(),
  ready: false,

  get: (path) => get().entries[normalize(path)],

  exists: (path) => normalize(path) in get().entries,

  list: (dir) => listEntries(get().entries, dir),

  mkdir: (path) => {
    const target = normalize(path);
    const { entries } = get();
    if (target in entries) return false;
    /* Refuse to create a folder in a place that does not exist. mkdir -p is
     * convenient and is also how a typo in an address bar silently produces a
     * tree nobody meant to make. */
    const parent = dirname(target);
    if (!(parent in entries) || entries[parent].kind !== "dir") return false;

    const now = Date.now();
    const next = {
      ...entries,
      [target]: { path: target, kind: "dir" as const, content: "", created: now, modified: now },
    };
    set({ entries: next });
    persist(next);
    return true;
  },

  writeFile: (path, content) => {
    const target = normalize(path);
    const { entries } = get();
    const parent = dirname(target);
    if (!(parent in entries) || entries[parent].kind !== "dir") return false;
    if (entries[target]?.kind === "dir") return false;

    const now = Date.now();
    const existing = entries[target];
    const next = {
      ...entries,
      [target]: {
        path: target,
        kind: "file" as const,
        content,
        created: existing?.created ?? now,
        modified: now,
      },
    };
    set({ entries: next });
    persist(next);
    return true;
  },

  readFile: (path) => {
    const entry = get().entries[normalize(path)];
    return entry?.kind === "file" ? entry.content : undefined;
  },

  remove: (path) => {
    const target = normalize(path);
    const { entries } = get();
    if (!(target in entries) || isDriveRoot(target)) return false;

    /* Recursive by definition: with a flat map, "delete the folder" and "delete
     * everything under it" are the same filter. A tree would need a walk here,
     * and a missed branch would leave orphans that list() could never show and
     * nothing could ever delete. */
    const next: Record<string, FsEntry> = {};
    for (const [key, value] of Object.entries(entries)) {
      if (key === target || isInside(target, key)) continue;
      next[key] = value;
    }
    set({ entries: next });
    persist(next);
    return true;
  },

  rename: (path, nextName) => {
    const target = normalize(path);
    if (!isValidName(nextName)) return null;
    return relocate(set, get, target, join(dirname(target), nextName.trim()));
  },

  move: (path, targetDir) => {
    const source = normalize(path);
    const destination = join(normalize(targetDir), basename(source));
    const { entries } = get();

    const folder = entries[normalize(targetDir)];
    if (!folder || folder.kind !== "dir") return null;
    /* Dropping a folder into itself, or into one of its own descendants, would
     * detach the whole subtree from the root: every key still exists, and none
     * of them is reachable from C: any more. */
    if (source === normalize(targetDir) || isInside(source, normalize(targetDir))) return null;

    return relocate(set, get, source, destination);
  },

  uniquePath: (dir, name) => {
    const { entries } = get();
    const ext = extname(name);
    const stem = ext ? name.slice(0, -ext.length) : name;

    let candidate = join(dir, name);
    let n = 2;
    while (candidate in entries) {
      candidate = join(dir, `${stem} (${n})${ext}`);
      n += 1;
    }
    return candidate;
  },
}));

/* Hydration, once, at module load.
 *
 * Replaces the seed wholesale rather than merging into it. Merging looks
 * friendlier and is wrong: it would resurrect every seeded file the moment
 * somebody deleted one.
 */
void (async () => {
  const stored = await idbGet<Record<string, FsEntry>>(STORAGE_KEY);
  if (stored && typeof stored === "object" && Object.keys(stored).length > 0) {
    useFsStore.setState({ entries: stored, ready: true });
  } else {
    useFsStore.setState({ ready: true });
    persist(useFsStore.getState().entries);
  }
})();
