import { create } from "zustand";

/* Folder Options, or the one of them that exists: "Show hidden files and
 * folders". Global, like XP's - it was a setting of Explorer, not of a
 * folder - and kept in localStorage with the rest of the shell state.
 * The desktop is a folder too and reads it.
 */

const KEY = "funos.folderOptions";

type Options = { showHidden: boolean };

const load = (): Options => {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    const p = parsed as Partial<Options> | null;
    return { showHidden: p?.showHidden === true };
  } catch {
    return { showHidden: false };
  }
};

const save = (o: Options) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(o));
  } catch {
    /* Private mode. */
  }
};

type FolderOptionsStore = Options & {
  setShowHidden: (show: boolean) => void;
};

export const useFolderOptions = create<FolderOptionsStore>((set) => ({
  ...load(),
  setShowHidden: (showHidden) => {
    save({ showHidden });
    set({ showHidden });
  },
}));
