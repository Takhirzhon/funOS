import { create } from "zustand";

/* The three Luna colour schemes, plus which screensaver waits for you.
 *
 * A theme is nothing but an attribute on <html>: every colour the shell draws
 * already comes from a custom property in one block of index.css, so a scheme
 * is an override of that block and not a line of component code. That was the
 * argument for putting the palette there in the first place and this is the
 * payment.
 */
export type Theme = "blue" | "olive" | "silver";
export type Saver = "none" | "starfield" | "pipes" | "mystify" | "maze" | "text";

export const THEME_NAMES: Record<Theme, string> = {
  blue: "Windows XP (Luna Blue)",
  olive: "Olive Green",
  silver: "Silver",
};

export const SAVER_NAMES: Record<Saver, string> = {
  none: "(None)",
  starfield: "Starfield",
  pipes: "3D Pipes",
  mystify: "Mystify",
  maze: "3D Maze",
  text: "3D Text",
};

const KEY = "funos.display";

/* The wallpaper: Bliss, nothing (the Luna blue), or a picture from the file
 * system by path - which is how a photograph in My Pictures, or one dropped
 * in from the host, becomes the background. XP's three ways of fitting it. */
export type Wallpaper = "bliss" | "none" | `C:${string}`;
export type WallpaperFit = "stretch" | "center" | "tile";

export const FIT_NAMES: Record<WallpaperFit, string> = {
  stretch: "Stretch",
  center: "Center",
  tile: "Tile",
};

type Stored = { theme: Theme; saver: Saver; idleMinutes: number; wallpaper: Wallpaper; fit: WallpaperFit };

const DEFAULTS: Stored = { theme: "blue", saver: "starfield", idleMinutes: 3, wallpaper: "bliss", fit: "stretch" };

const load = (): Stored => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Stored>;
    /* Validated field by field rather than trusted: a half-written or
     * hand-edited entry should cost the setting, not the desktop. */
    return {
      theme: parsed.theme && parsed.theme in THEME_NAMES ? parsed.theme : DEFAULTS.theme,
      saver: parsed.saver && parsed.saver in SAVER_NAMES ? parsed.saver : DEFAULTS.saver,
      idleMinutes:
        typeof parsed.idleMinutes === "number" && parsed.idleMinutes > 0
          ? Math.min(60, parsed.idleMinutes)
          : DEFAULTS.idleMinutes,
      wallpaper:
        parsed.wallpaper === "none" || parsed.wallpaper === "bliss" || (typeof parsed.wallpaper === "string" && parsed.wallpaper.startsWith("C:"))
          ? (parsed.wallpaper as Wallpaper)
          : DEFAULTS.wallpaper,
      fit: parsed.fit && parsed.fit in FIT_NAMES ? parsed.fit : DEFAULTS.fit,
    };
  } catch {
    return DEFAULTS;
  }
};

const save = (state: Stored) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* Private mode. The setting lasts the session. */
  }
};

type ThemeStore = Stored & {
  setTheme: (theme: Theme) => void;
  setSaver: (saver: Saver) => void;
  setIdleMinutes: (minutes: number) => void;
  setWallpaper: (wallpaper: Wallpaper, fit?: WallpaperFit) => void;
  setFit: (fit: WallpaperFit) => void;
};

const initial = load();

/* Applied to <html> rather than to a React root element, so the attribute is
 * in place before the first paint and there is no flash of the wrong scheme.
 */
const apply = (theme: Theme) => {
  document.documentElement.dataset.theme = theme;
};
apply(initial.theme);

export const useThemeStore = create<ThemeStore>((set, get) => ({
  ...initial,

  setTheme: (theme) => {
    apply(theme);
    set({ theme });
    save({ ...get(), theme });
  },

  setSaver: (saver) => {
    set({ saver });
    save({ ...get(), saver });
  },

  setIdleMinutes: (idleMinutes) => {
    const clamped = Math.max(1, Math.min(60, Math.round(idleMinutes)));
    set({ idleMinutes: clamped });
    save({ ...get(), idleMinutes: clamped });
  },

  setWallpaper: (wallpaper, fit) => {
    const next = { wallpaper, fit: fit ?? get().fit };
    set(next);
    save({ ...get(), ...next });
  },

  setFit: (fit) => {
    set({ fit });
    save({ ...get(), fit });
  },
}));
