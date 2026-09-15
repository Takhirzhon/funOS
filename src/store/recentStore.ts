import { create } from "zustand";

/* My Recent Documents - the Start menu's list of what was opened last.
 *
 * Paths only, newest first, fifteen of them, in localStorage: it is shell
 * state like the icon positions, not a file. A path that no longer exists is
 * dropped when the list is read, not when the file goes - the list does not
 * watch the file system, and Windows showed dead shortcuts there too.
 */

const KEY = "funos.recent";
const MAX = 15;

const load = (): string[] => {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === "string") : [];
  } catch {
    return [];
  }
};

const save = (paths: string[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(paths));
  } catch {
    /* Private mode. The menu just stays short. */
  }
};

type RecentStore = {
  paths: string[];
  /** A document was opened: to the top, or newly on top. */
  touch: (path: string) => void;
  /** A renamed or moved file keeps its place under its new name. */
  rename: (from: string, to: string) => void;
  clear: () => void;
};

export const useRecentStore = create<RecentStore>((set) => ({
  paths: load(),

  touch: (path) =>
    set((s) => {
      const paths = [path, ...s.paths.filter((p) => p !== path)].slice(0, MAX);
      save(paths);
      return { paths };
    }),

  rename: (from, to) =>
    set((s) => {
      if (!s.paths.includes(from)) return s;
      const paths = s.paths.map((p) => (p === from ? to : p));
      save(paths);
      return { paths };
    }),

  clear: () => {
    save([]);
    set({ paths: [] });
  },
}));
