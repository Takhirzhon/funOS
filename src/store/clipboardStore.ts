import { create } from "zustand";

/* The shell clipboard - what Cut and Copy put there, and Paste takes out.
 *
 * Deliberately not the system clipboard. `navigator.clipboard` holds text and
 * images, not "these files, to be moved", and asking for permission to read it
 * mid-paste would put a browser prompt in the middle of a file operation. This
 * one is internal to funOS and honest about it.
 *
 * Cut does not remove anything at the time it is pressed: it records an
 * intention, and Paste is what performs the move. That is why the source stays
 * on screen, ghosted, until the paste happens, and why pressing Cut and then
 * Escape leaves the files exactly where they were.
 */
type Mode = "copy" | "cut";

type ClipboardStore = {
  /* A list, not a path. Holding one was the thing that made every selection in
   * the shell effectively single-item: the marquee could select five icons and
   * only the first could be copied. */
  paths: string[];
  mode: Mode;
  cut: (paths: string[]) => void;
  copy: (paths: string[]) => void;
  clear: () => void;
  /** Whether a given path is on the clipboard and waiting to be moved. */
  isCut: (path: string) => boolean;
};

export const useClipboardStore = create<ClipboardStore>((set, get) => ({
  paths: [],
  mode: "copy",
  cut: (paths) => set({ paths: [...paths], mode: "cut" }),
  copy: (paths) => set({ paths: [...paths], mode: "copy" }),
  clear: () => set((s) => (s.paths.length === 0 ? s : { paths: [] })),
  isCut: (path) => {
    const s = get();
    return s.mode === "cut" && s.paths.includes(path);
  },
}));
