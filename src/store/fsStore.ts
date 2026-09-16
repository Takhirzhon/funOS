import { create } from "zustand";
import { idbGet, idbSet } from "../fs/idb";
import { RECYCLE_BIN, buildSeed } from "../fs/seed";
import { containsSystemPath, isSystemPath, systemOverlay } from "../fs/system";
import { useRecentStore } from "./recentStore";
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
  /** Text payload. Empty for directories and for binary files. */
  content: string;
  /* Binary payload. Its *presence* is what makes a file binary - there is no
   * separate `encoding` field to get out of step with the data.
   *
   * Added alongside `content` rather than replacing it with a `string | Blob`
   * union, which would have been tidier on paper. The file system is already
   * live and holding somebody's files: an additive field needs no migration
   * and cannot mangle an entry written by an older build, where a union would
   * need migration code that can only be tested against data I do not have.
   *
   * Uint8Array rather than Blob because reading a Blob is asynchronous, and
   * every caller from Notepad to the thumbnail grid reads synchronously during
   * render. Bytes convert to a Blob URL in one synchronous line when a browser
   * API actually needs one.
   */
  bytes?: Uint8Array;
  /** MIME type, binary files only. */
  mime?: string;
  /* A file that lives on the server rather than in the map: the portfolio,
   * shipped under public/portfolio/ and laid over the tree by fs/system.ts.
   * Its bytes are never here - a browser element points at the URL directly,
   * which is the only sane way to show a 40MB video from a file system that
   * serializes itself to IndexedDB on every write.
   */
  url?: string;
  /** Byte length of a `url` file, known from the build. Nothing else sets it. */
  size?: number;
  /** A small rendering of a served picture or clip, for grids. Served too. */
  thumb?: string;
  /* The Hidden attribute, set from the Properties dialog. Additive, like
   * `bytes`: an entry written before it existed simply is not hidden, which
   * is also what it was. */
  hidden?: boolean;
  /* Where this came from, set only on the top entry of something in the Recycle
   * Bin. Children of a recycled folder do not carry one - restoring the folder
   * brings them with it, and a per-child path would be a second copy of the
   * same fact, free to disagree with the first.
   */
  restorePath?: string;
  created: number;
  modified: number;
};

/** True for files written by `writeBinary` and for served ones - the ones
 *  Notepad cannot show. */
export const isBinary = (entry: FsEntry | undefined): boolean =>
  entry?.kind === "file" && (entry.bytes !== undefined || entry.url !== undefined);

/* Object URLs are cached per path+timestamp. Minting a new one on every render
 * leaks: each URL pins its Blob in memory until revoked, and a thumbnail grid
 * re-rendering on every keystroke would mint one per image per keystroke.
 */
const urlCache = new Map<string, { key: string; url: string }>();

export function blobUrlFor(entry: FsEntry): string | undefined {
  if (entry.url) return entry.url;
  if (!entry.bytes) return undefined;
  const key = `${entry.modified}:${entry.bytes.byteLength}`;
  const cached = urlCache.get(entry.path);
  if (cached?.key === key) return cached.url;
  if (cached) URL.revokeObjectURL(cached.url);
  const url = URL.createObjectURL(
    new Blob([entry.bytes as unknown as BlobPart], { type: entry.mime ?? "application/octet-stream" })
  );
  urlCache.set(entry.path, { key, url });
  return url;
}

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
  writeBinary: (path: string, bytes: Uint8Array, mime: string) => boolean;
  readFile: (path: string) => string | undefined;
  remove: (path: string) => boolean;
  rename: (path: string, nextName: string) => string | null;
  /** Move an entry into `targetDir`, keeping its name. Returns the new path. */
  move: (path: string, targetDir: string) => string | null;
  /** Duplicate an entry into `targetDir`, renaming if the name is taken. */
  copy: (path: string, targetDir: string) => string | null;

  /** Move into the Recycle Bin, remembering where it came from. */
  recycle: (path: string) => string | null;
  /** Put a recycled entry back where it was. */
  restore: (path: string) => string | null;
  /** Delete everything in the Recycle Bin, permanently. */
  emptyBin: () => void;

  /** "New Folder", then "New Folder (2)" - the first free name in `dir`. */
  uniquePath: (dir: string, name: string) => string;
  /** The Hidden attribute. Refused for system files, like everything else. */
  setHidden: (path: string, hidden: boolean) => boolean;
};

/* Writes are batched. Typing in Notepad fires one per keystroke, and each one
 * serializes the whole file system; without this the editor would stutter on a
 * large-ish file for no benefit, since nothing reads the database until the
 * next page load.
 */
let saveTimer: ReturnType<typeof setTimeout> | undefined;
const persist = (entries: Record<string, FsEntry>) => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    /* The system layer is never written. Persisting it would freeze this
     * build's manifest into every visitor's database, and a file removed from
     * the portfolio later would linger there with nothing able to delete it. */
    const own: Record<string, FsEntry> = {};
    for (const [key, value] of Object.entries(entries)) {
      if (!isSystemPath(key)) own[key] = value;
    }
    void idbSet(STORAGE_KEY, own);
  }, 250);
};

/* Exported as a pure function as well as a store method.
 *
 * A component that calls `useFsStore(s => s.list)(dir)` subscribes to the
 * *method*, which never changes, so it would never re-render when a file was
 * created. Subscribing to `entries` and calling this is the version that
 * actually updates.
 */
/* Hidden, two ways.
 *
 * By path for the machinery - the Recycle Bin's storage lives at a known
 * place, and a rule reaches entries written before any flag existed. By the
 * entry's own attribute for everything else, which is the Hidden checkbox in
 * Properties. "Show hidden files and folders" (store/folderOptions.ts)
 * reveals the second kind; nothing reveals the first except the bin itself.
 */
export const isHiddenPath = (path: string): boolean =>
  path === RECYCLE_BIN || isInside(RECYCLE_BIN, path);

export const isHiddenEntry = (entry: FsEntry): boolean => entry.hidden === true || isHiddenPath(entry.path);

export function listEntries(
  entries: Record<string, FsEntry>,
  dir: string,
  includeHidden: boolean | "attribute" = false
): FsEntry[] {
  const parent = normalize(dir);
  return Object.values(entries)
    .filter((e) => e.path !== parent && dirname(e.path) === parent)
    .filter((e) =>
      includeHidden === true ? true : includeHidden === "attribute" ? !isHiddenPath(e.path) : !isHiddenEntry(e)
    )
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
  /* A system file stays where the build put it, and so does any folder with
   * one inside - moving the folder would move the file. The callers check
   * first and say why; this is the guarantee behind the message. */
  if (containsSystemPath(from)) return null;

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
  /* The recent list follows a rename, or it would point at a name that no
   * longer exists and drop the file from the menu for being renamed. */
  useRecentStore.getState().rename(from, to);
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

/* The system layer wins over whatever is underneath it - the seed now, the
 * stored tree once it arrives. A visitor who saved their own CV.pdf on the
 * desktop last year sees this build's, which is the point. */
const withSystem = (entries: Record<string, FsEntry>): Record<string, FsEntry> => ({
  ...entries,
  ...systemOverlay(),
});

export const useFsStore = create<FsStore>((set, get) => ({
  entries: withSystem(buildSeed()),
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
    if (isSystemPath(target)) return false;

    const now = Date.now();
    const existing = entries[target];
    const next = {
      ...entries,
      [target]: {
        path: target,
        kind: "file" as const,
        content,
        /* Saving text over a file that used to be binary has to drop the bytes,
         * or the entry keeps reporting itself as binary and the text is
         * invisible everywhere. */
        created: existing?.created ?? now,
        modified: now,
      },
    };
    set({ entries: next });
    persist(next);
    return true;
  },

  writeBinary: (path, bytes, mime) => {
    const target = normalize(path);
    const { entries } = get();
    const parent = dirname(target);
    if (!(parent in entries) || entries[parent].kind !== "dir") return false;
    if (entries[target]?.kind === "dir") return false;
    if (isSystemPath(target)) return false;

    const now = Date.now();
    const next = {
      ...entries,
      [target]: {
        path: target,
        kind: "file" as const,
        content: "",
        bytes,
        mime,
        created: entries[target]?.created ?? now,
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
    if (containsSystemPath(target)) return false;

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

  copy: (path, targetDir) => {
    const source = normalize(path);
    const folder = normalize(targetDir);
    const { entries, uniquePath } = get();

    const entry = entries[source];
    const parent = entries[folder];
    if (!entry || !parent || parent.kind !== "dir") return null;
    /* Copying a folder into itself would recurse until the map ran out of
     * memory: every pass would find the copy it had just made. */
    if (source === folder || isInside(source, folder)) return null;

    /* Never silently overwrite. Pasting into the folder something already lives
     * in is the common case, and "Copy (2)" is what Windows does with it. */
    const destination = uniquePath(folder, basename(source));

    const now = Date.now();
    const next = { ...entries };
    const clone = (from: string, to: string) => {
      const original = entries[from];
      next[to] = {
        ...original,
        path: to,
        /* A fresh Uint8Array, not the same one. Sharing the buffer would mean
         * editing one copy's bytes edited the other's - which nothing does
         * today and everything would do the moment Paint can save. */
        bytes: original.bytes ? new Uint8Array(original.bytes) : undefined,
        created: now,
        modified: now,
      };
    };

    clone(source, destination);
    for (const key of Object.keys(entries)) {
      if (isInside(source, key)) clone(key, destination + key.slice(source.length));
    }

    set({ entries: next });
    persist(next);
    return destination;
  },

  /* Recycling is a move plus one remembered fact. It is deliberately not a
   * separate storage area: a bin that holds copies would double the disk cost
   * of every deletion and would need its own rename, listing and size logic.
   */
  recycle: (path) => {
    const source = normalize(path);
    const { entries, uniquePath } = get();
    const entry = entries[source];
    if (!entry || isDriveRoot(source)) return null;
    /* Recycling something already in the bin would be a no-op that quietly
     * rewrote its restorePath to a path inside the bin - so it could never be
     * restored again. */
    if (source === RECYCLE_BIN || isInside(RECYCLE_BIN, source)) return null;

    const destination = relocate(set, get, source, uniquePath(RECYCLE_BIN, basename(source)));
    if (destination === null) return null;

    const next = {
      ...get().entries,
      [destination]: { ...get().entries[destination], restorePath: source },
    };
    set({ entries: next });
    persist(next);
    return destination;
  },

  restore: (path) => {
    const source = normalize(path);
    const { entries, uniquePath } = get();
    const entry = entries[source];
    if (!entry?.restorePath) return null;

    const parent = dirname(entry.restorePath);
    if (entries[parent]?.kind !== "dir") return null;

    /* Something may have taken the name back while this sat in the bin, so the
     * restore gets a free one rather than overwriting whatever is there now. */
    const destination = relocate(
      set,
      get,
      source,
      uniquePath(parent, basename(entry.restorePath))
    );
    if (destination === null) return null;

    const restored = { ...get().entries[destination] };
    delete restored.restorePath;
    const next = { ...get().entries, [destination]: restored };
    set({ entries: next });
    persist(next);
    return destination;
  },

  emptyBin: () => {
    const { entries } = get();
    const next: Record<string, FsEntry> = {};
    for (const [key, value] of Object.entries(entries)) {
      if (isInside(RECYCLE_BIN, key)) continue;
      next[key] = value;
    }
    set({ entries: next });
    persist(next);
  },

  setHidden: (path, hidden) => {
    const target = normalize(path);
    const { entries } = get();
    const entry = entries[target];
    if (!entry || isDriveRoot(target) || isSystemPath(target)) return false;
    if ((entry.hidden === true) === hidden) return true;
    const next = { ...entries, [target]: { ...entry, hidden: hidden || undefined } };
    set({ entries: next });
    persist(next);
    return true;
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
    useFsStore.setState({ entries: withSystem(stored), ready: true });
  } else {
    useFsStore.setState({ ready: true });
    persist(useFsStore.getState().entries);
  }
})();
