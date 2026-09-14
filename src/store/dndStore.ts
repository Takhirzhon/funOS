import { create } from "zustand";

/* The bridge between the desktop's drag and everyone else's.
 *
 * The desktop drags icons with pointer events, because it is moving them to a
 * position. Explorer uses HTML5 drag and drop, because it is moving files into
 * a folder. Those two systems do not see each other: an HTML5 drop target never
 * hears about a pointer drag, no matter where the pointer goes.
 *
 * Rather than converting one to the other - which would cost the desktop its
 * free positioning, or Explorer its ability to accept files from the host OS -
 * a pointer drag that leaves the desktop asks the document what is under the
 * cursor and looks for a `data-drop-path` attribute. Any component that wants
 * to accept a dragged file advertises itself with that attribute and reads
 * `hoverPath` to highlight itself. It is a one-way channel and it is small.
 */
type DndStore = {
  /** Folder under the cursor during a desktop drag, or null. */
  hoverPath: string | null;
  setHoverPath: (path: string | null) => void;
};

export const useDndStore = create<DndStore>((set) => ({
  hoverPath: null,
  setHoverPath: (path) => set((s) => (s.hoverPath === path ? s : { hoverPath: path })),
}));

/** The folder path advertised by whatever is under these coordinates. */
export function dropPathAt(x: number, y: number): string | null {
  const element = document.elementFromPoint(x, y);
  const host = element?.closest<HTMLElement>("[data-drop-path]");
  return host?.dataset.dropPath ?? null;
}
