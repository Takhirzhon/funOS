import { create } from "zustand";

/* The icon grid. Windows lays desktop icons out on a fixed lattice and snaps to
 * it; free positioning is what makes a desktop look like a corkboard.
 */
export const CELL_W = 80;
export const CELL_H = 84;
export const FIELD_PAD = 8;

export type Pos = { x: number; y: number };

const STORAGE_KEY = "funos.desktop.positions";

/* Positions survive a reload, because a desktop that forgets where you put
 * things is not a desktop. localStorage rather than the (not yet existing)
 * virtual file system: this is shell state, not a file, and moving it later is
 * one function.
 */
const load = (): Record<string, Pos> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    /* Trusting the shape here would mean a hand-edited or half-written entry
     * crashes the desktop on load, with no way to recover except clearing site
     * data - which most visitors do not know how to do.
     */
    const out: Record<string, Pos> = {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      const p = value as Partial<Pos> | null;
      if (p && typeof p.x === "number" && typeof p.y === "number") {
        out[id] = { x: p.x, y: p.y };
      }
    }
    return out;
  } catch {
    return {};
  }
};

const save = (positions: Record<string, Pos>) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  } catch {
    /* Private mode, or a full quota. Losing icon positions is not worth an
     * error dialog. */
  }
};

/** Snap a dropped position onto the lattice, and never off the top or left. */
export const snap = (pos: Pos): Pos => ({
  x: Math.max(0, Math.round((pos.x - FIELD_PAD) / CELL_W)) * CELL_W + FIELD_PAD,
  y: Math.max(0, Math.round((pos.y - FIELD_PAD) / CELL_H)) * CELL_H + FIELD_PAD,
});

/** Where an icon goes before anyone has dragged it: down column one, then over. */
export const defaultPosition = (index: number, rows: number): Pos => {
  const safeRows = Math.max(1, rows);
  return {
    x: Math.floor(index / safeRows) * CELL_W + FIELD_PAD,
    y: (index % safeRows) * CELL_H + FIELD_PAD,
  };
};

type DesktopStore = {
  positions: Record<string, Pos>;
  selection: string[];
  setPosition: (id: string, pos: Pos) => void;
  /** Replace the selection wholesale - what a click or a finished marquee does. */
  select: (ids: string[]) => void;
  clearSelection: () => void;
  /** Forget every stored position, so the field falls back to auto-arrange. */
  resetPositions: () => void;
};

export const useDesktopStore = create<DesktopStore>((set) => ({
  positions: load(),
  selection: [],

  setPosition: (id, pos) =>
    set((s) => {
      const positions = { ...s.positions, [id]: pos };
      save(positions);
      return { positions };
    }),

  select: (ids) => set({ selection: ids }),

  clearSelection: () => set((s) => (s.selection.length ? { selection: [] } : s)),

  resetPositions: () =>
    set(() => {
      save({});
      return { positions: {} };
    }),
}));
