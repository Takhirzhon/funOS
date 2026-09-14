import { create } from "zustand";

/* The shell clipboard - what Cut and Copy put there, and Paste takes out.
 *
 * Deliberately not the system clipboard. `navigator.clipboard` holds text and
 * images, not "this file, to be moved", and asking for permission to read it
 * mid-paste would put a browser prompt in the middle of a file operation. This
 * one is internal to funOS and honest about it.
 *
 * Cut does not remove anything at the time it is pressed: it records an
 * intention, and Paste is what performs the move. That is why the source stays
 * on screen (dimmed, in Windows) until the paste happens, and why pressing Cut
 * and then Escape leaves the file exactly where it was.
 */
type Mode = "copy" | "cut";

type ClipboardStore = {
  path: string | null;
  mode: Mode;
  cut: (path: string) => void;
  copy: (path: string) => void;
  clear: () => void;
};

export const useClipboardStore = create<ClipboardStore>((set) => ({
  path: null,
  mode: "copy",
  cut: (path) => set({ path, mode: "cut" }),
  copy: (path) => set({ path, mode: "copy" }),
  clear: () => set((s) => (s.path === null ? s : { path: null })),
}));
