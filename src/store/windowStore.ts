import { create } from "zustand";
import { playSound } from "./soundStore";
import { COMPACT, matches } from "../hooks/useMediaQuery";

export type Bounds = { x: number; y: number; width: number; height: number };

/* Kept in step with --taskbar-height in index.css. A maximized window has to
 * stop where the taskbar starts, and that is the one place the layout needs the
 * number in JavaScript rather than CSS.
 */
export const TASKBAR_HEIGHT = 30;

export type WindowState = {
  id: string;
  appId: string;
  title: string;
  bounds: Bounds;
  prevBounds?: Bounds;
  zIndex: number;
  minimized: boolean;
  maximized: boolean;
  props?: Record<string, unknown>;
};

type Store = {
  windows: WindowState[];
  topZ: number;
  focusedId: string | null;
  open: (
    appId: string,
    opts?: {
      title?: string;
      bounds?: Partial<Bounds>;
      props?: Record<string, unknown>;
    }
  ) => string;
  close: (id: string) => void;
  focus: (id: string) => void;
  /** Nothing is focused - what clicking the desktop does. */
  blur: () => void;
  setBounds: (id: string, bounds: Partial<Bounds>) => void;
  /** An app renaming its own window - Notepad following the file it has open. */
  setTitle: (id: string, title: string) => void;
  toggleMaximize: (id: string) => void;
  minimize: (id: string) => void;
  minimizeAll: () => void;
  /** Overlapping, offset down-right from the top-left. */
  cascade: () => void;
  /** Every non-minimized window given an equal share of the desktop. */
  tile: (orientation: "horizontal" | "vertical") => void;
  restore: (id: string) => void;
  toggleFromTaskbar: (id: string) => void;
  /** The viewport changed: maximized windows fill the new one, the rest stay on it. */
  fit: () => void;
};

let idCounter = 0;
const nextId = () => `w${++idCounter}`;

/* Where each program's window was last left, by app id. XP remembered this
 * per window class, which is why Notepad opened where you last had it and
 * Explorer at whatever size you had dragged it to. localStorage: shell
 * state, like the icon positions. */
const MEMORY_KEY = "funos.windows";

const loadMemory = (): Record<string, Bounds> => {
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    const out: Record<string, Bounds> = {};
    if (parsed && typeof parsed === "object") {
      for (const [id, v] of Object.entries(parsed as Record<string, Partial<Bounds>>)) {
        if (
          v &&
          typeof v.x === "number" &&
          typeof v.y === "number" &&
          typeof v.width === "number" &&
          typeof v.height === "number"
        ) {
          out[id] = { x: v.x, y: v.y, width: v.width, height: v.height };
        }
      }
    }
    return out;
  } catch {
    return {};
  }
};

const memory: Record<string, Bounds> = loadMemory();

const remember = (appId: string, bounds: Bounds) => {
  memory[appId] = bounds;
  try {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(memory));
  } catch {
    /* Private mode: windows open where they always did. */
  }
};

const cascadeOffset = (n: number) => 24 + (n % 8) * 24;

/* The whole desktop: what a maximized window fills.
 *
 * The layout viewport, not `innerWidth`. On a phone, the moment anything is
 * wider than the screen - a landscape-sized window after turning back to
 * portrait - mobile Chrome zooms out to show it all, and `innerWidth` then
 * reports the zoomed-out width: 844 on a 390px screen. Sizing the window to
 * that keeps it too wide, which keeps the page zoomed out, forever. The
 * document element's client size is the screen in CSS pixels regardless. */
const fullBounds = (): Bounds => ({
  x: 0,
  y: 0,
  width: document.documentElement.clientWidth,
  height: document.documentElement.clientHeight - TASKBAR_HEIGHT,
});

/* A window that would hang off the edge is pulled back onto the screen, and
 * one wider than the screen is narrowed to fit. Applied when restoring, and
 * when the viewport shrinks under a window that was fine a moment ago - a
 * phone turning sideways, a browser window being dragged narrower. */
const clamp = (b: Bounds): Bounds => {
  const area = fullBounds();
  const width = Math.min(b.width, area.width);
  const height = Math.min(b.height, area.height);
  return {
    width,
    height,
    x: Math.max(0, Math.min(b.x, area.width - width)),
    y: Math.max(0, Math.min(b.y, area.height - height)),
  };
};

export const useWindowStore = create<Store>((set, get) => ({
  windows: [],
  topZ: 10,
  focusedId: null,

  open: (appId, opts = {}) => {
    /* Every window opening clicks, the way every folder did. */
    playSound("click");
    const id = nextId();
    const { topZ, windows } = get();
    const newZ = topZ + 1;
    const offset = cascadeOffset(windows.length);
    /* The remembered place wins over the app's default, unless the caller
     * asked for a position outright. A second window of the same program
     * steps down and right from the first, so they do not stack exactly. */
    const kept = opts.bounds?.x === undefined ? memory[appId] : undefined;
    const twins = windows.filter((w) => w.appId === appId).length;
    const bounds: Bounds = kept
      ? clamp({ ...kept, x: kept.x + twins * 24, y: kept.y + twins * 24 })
      : {
          x: opts.bounds?.x ?? 80 + offset,
          y: opts.bounds?.y ?? 60 + offset,
          width: opts.bounds?.width ?? 520,
          height: opts.bounds?.height ?? 380,
        };
    /* On a small screen every window opens maximized. A 520px Notepad on a
     * 390px phone is a window with its right third off the screen and its
     * close button with it; maximized, it is Notepad. Restore still works and
     * gives back the size the app asked for, clamped to whatever fits. */
    const compact = matches(COMPACT);
    const win: WindowState = {
      id,
      appId,
      title: opts.title ?? appId,
      bounds: compact ? fullBounds() : bounds,
      prevBounds: compact ? bounds : undefined,
      zIndex: newZ,
      minimized: false,
      maximized: compact,
      props: opts.props,
    };
    set({ windows: [...windows, win], topZ: newZ, focusedId: id });
    return id;
  },

  close: (id) =>
    set((s) => {
      /* The last thing a window does is say where it was. A maximized one
       * remembers the size it had before, not the whole screen. */
      const w = s.windows.find((w) => w.id === id);
      if (w) remember(w.appId, w.maximized ? (w.prevBounds ?? w.bounds) : w.bounds);
      return {
        windows: s.windows.filter((w) => w.id !== id),
        focusedId: s.focusedId === id ? null : s.focusedId,
      };
    }),

  focus: (id) =>
    set((s) => {
      const w = s.windows.find((w) => w.id === id);
      if (!w) return s;
      if (w.minimized) playSound("restore");
      const newZ = s.topZ + 1;
      return {
        topZ: newZ,
        focusedId: id,
        windows: s.windows.map((w) =>
          w.id === id ? { ...w, zIndex: newZ, minimized: false } : w
        ),
      };
    }),

  /* Clicking the desktop really does deactivate the window in Windows: its
   * title bar goes grey, and the keyboard belongs to the desktop again. That
   * second half is what the clipboard shortcuts hang off. */
  blur: () => set((s) => (s.focusedId === null ? s : { focusedId: null })),

  setBounds: (id, bounds) =>
    set((s) => ({
      windows: s.windows.map((w) => {
        if (w.id !== id) return w;
        const next = { ...w.bounds, ...bounds };
        remember(w.appId, next);
        return { ...w, bounds: next };
      }),
    })),

  setTitle: (id, title) =>
    set((s) => {
      /* Bail out when nothing changed. An app that sets its caption from an
       * effect on every render would otherwise loop: new state object, new
       * render, new set. */
      const current = s.windows.find((w) => w.id === id);
      if (!current || current.title === title) return s;
      return { windows: s.windows.map((w) => (w.id === id ? { ...w, title } : w)) };
    }),

  toggleMaximize: (id) =>
    set((s) => ({
      windows: s.windows.map((w) => {
        if (w.id !== id) return w;
        if (w.maximized) {
          return {
            ...w,
            maximized: false,
            bounds: clamp(w.prevBounds ?? w.bounds),
            prevBounds: undefined,
          };
        }
        return {
          ...w,
          maximized: true,
          prevBounds: w.bounds,
          bounds: fullBounds(),
        };
      }),
    })),

  minimize: (id) => {
    playSound("minimize");
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id ? { ...w, minimized: true } : w
      ),
      focusedId: s.focusedId === id ? null : s.focusedId,
    }));
  },

  /* Show the Desktop. Minimizes rather than hides, so the task buttons stay put
   * and clicking one brings its window back - which is what the real button
   * does, and why it is not called "hide all".
   */
  minimizeAll: () =>
    set((s) => ({
      windows: s.windows.map((w) => ({ ...w, minimized: true })),
      focusedId: null,
    })),

  /* Cascade and Tile both act on the windows that are actually on screen.
   * Including minimized ones would "arrange" windows nobody can see and, worse,
   * silently un-minimize them - which is not what either command does.
   */
  cascade: () =>
    set((s) => {
      const visible = s.windows.filter((w) => !w.minimized);
      const area = fullBounds();
      const width = Math.max(360, Math.round(area.width * 0.55));
      const height = Math.max(240, Math.round(area.height * 0.62));
      return {
        windows: s.windows.map((w) => {
          const index = visible.indexOf(w);
          if (index === -1) return w;
          const offset = index * 26;
          return {
            ...w,
            maximized: false,
            prevBounds: undefined,
            bounds: {
              /* Wrap before the stack marches off the bottom right. Eight is
               * about where XP gives up too. */
              x: 12 + (offset % (Math.max(1, area.width - width - 24) || 1)),
              y: 12 + (offset % Math.max(1, area.height - height - 24)),
              width,
              height,
            },
          };
        }),
      };
    }),

  tile: (orientation) =>
    set((s) => {
      const visible = s.windows.filter((w) => !w.minimized);
      if (visible.length === 0) return s;

      const area = fullBounds();
      /* "Tile Horizontally" in Windows means the windows are stacked in
       * horizontal bands, not laid out in a horizontal row. It reads backwards
       * and it is what the menu item does. */
      const columns = orientation === "vertical" ? visible.length : 1;
      const rows = orientation === "vertical" ? 1 : visible.length;
      const cellWidth = Math.floor(area.width / columns);
      const cellHeight = Math.floor(area.height / rows);

      return {
        windows: s.windows.map((w) => {
          const index = visible.indexOf(w);
          if (index === -1) return w;
          return {
            ...w,
            maximized: false,
            prevBounds: undefined,
            bounds: {
              x: (index % columns) * cellWidth,
              y: Math.floor(index / columns) * cellHeight,
              width: cellWidth,
              height: cellHeight,
            },
          };
        }),
      };
    }),

  restore: (id) => get().focus(id),

  fit: () =>
    set((s) => ({
      windows: s.windows.map((w) => ({
        ...w,
        bounds: w.maximized ? fullBounds() : clamp(w.bounds),
      })),
    })),

  toggleFromTaskbar: (id) => {
    const { windows, focusedId, minimize, focus } = get();
    const w = windows.find((w) => w.id === id);
    if (!w) return;
    if (w.minimized) {
      focus(id);
    } else if (focusedId === id) {
      minimize(id);
    } else {
      focus(id);
    }
  },
}));

/* A maximized window is sized in pixels when it is maximized, and nothing
 * re-sized it afterwards - so turning a phone sideways left a portrait-shaped
 * window on a landscape screen. Listened for here rather than in a component
 * because it is the store's numbers that are wrong, not anything's render. */
if (typeof window !== "undefined") {
  window.addEventListener("resize", () => useWindowStore.getState().fit());
}
