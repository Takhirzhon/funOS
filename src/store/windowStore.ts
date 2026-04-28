import { create } from "zustand";

export type Bounds = { x: number; y: number; width: number; height: number };

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
  setBounds: (id: string, bounds: Partial<Bounds>) => void;
  toggleMaximize: (id: string) => void;
  minimize: (id: string) => void;
  restore: (id: string) => void;
  toggleFromTaskbar: (id: string) => void;
};

let idCounter = 0;
const nextId = () => `w${++idCounter}`;

const cascadeOffset = (n: number) => 24 + (n % 8) * 24;

export const useWindowStore = create<Store>((set, get) => ({
  windows: [],
  topZ: 10,
  focusedId: null,

  open: (appId, opts = {}) => {
    const id = nextId();
    const { topZ, windows } = get();
    const newZ = topZ + 1;
    const offset = cascadeOffset(windows.length);
    const bounds: Bounds = {
      x: opts.bounds?.x ?? 80 + offset,
      y: opts.bounds?.y ?? 60 + offset,
      width: opts.bounds?.width ?? 520,
      height: opts.bounds?.height ?? 380,
    };
    const win: WindowState = {
      id,
      appId,
      title: opts.title ?? appId,
      bounds,
      zIndex: newZ,
      minimized: false,
      maximized: false,
      props: opts.props,
    };
    set({ windows: [...windows, win], topZ: newZ, focusedId: id });
    return id;
  },

  close: (id) =>
    set((s) => ({
      windows: s.windows.filter((w) => w.id !== id),
      focusedId: s.focusedId === id ? null : s.focusedId,
    })),

  focus: (id) =>
    set((s) => {
      const w = s.windows.find((w) => w.id === id);
      if (!w) return s;
      const newZ = s.topZ + 1;
      return {
        topZ: newZ,
        focusedId: id,
        windows: s.windows.map((w) =>
          w.id === id ? { ...w, zIndex: newZ, minimized: false } : w
        ),
      };
    }),

  setBounds: (id, bounds) =>
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id ? { ...w, bounds: { ...w.bounds, ...bounds } } : w
      ),
    })),

  toggleMaximize: (id) =>
    set((s) => ({
      windows: s.windows.map((w) => {
        if (w.id !== id) return w;
        if (w.maximized) {
          return {
            ...w,
            maximized: false,
            bounds: w.prevBounds ?? w.bounds,
            prevBounds: undefined,
          };
        }
        return {
          ...w,
          maximized: true,
          prevBounds: w.bounds,
          bounds: {
            x: 0,
            y: 0,
            width: window.innerWidth,
            height: window.innerHeight - 30,
          },
        };
      }),
    })),

  minimize: (id) =>
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id ? { ...w, minimized: true } : w
      ),
      focusedId: s.focusedId === id ? null : s.focusedId,
    })),

  restore: (id) => get().focus(id),

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
