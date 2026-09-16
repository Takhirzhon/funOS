import { create } from "zustand";

/* The shell's own settings: what Taskbar and Start Menu Properties and Date
 * and Time set. One store, one key in localStorage, validated on the way in
 * like every other setting here.
 */

const KEY = "funos.shell";

type Stored = {
  /** An IANA zone, or "auto" for the browser's. */
  timeZone: string;
  locked: boolean;
  autoHide: boolean;
  quickLaunch: boolean;
  showClock: boolean;
};

const DEFAULTS: Stored = { timeZone: "auto", locked: false, autoHide: false, quickLaunch: true, showClock: true };

const validZone = (z: unknown): z is string => {
  if (typeof z !== "string") return false;
  if (z === "auto") return true;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: z });
    return true;
  } catch {
    return false;
  }
};

const load = (): Stored => {
  try {
    const raw = localStorage.getItem(KEY);
    const p = (raw ? JSON.parse(raw) : {}) as Partial<Stored>;
    return {
      timeZone: validZone(p.timeZone) ? p.timeZone : DEFAULTS.timeZone,
      locked: p.locked === true,
      autoHide: p.autoHide === true,
      quickLaunch: p.quickLaunch !== false,
      showClock: p.showClock !== false,
    };
  } catch {
    return DEFAULTS;
  }
};

const save = (s: Stored) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* Private mode. */
  }
};

type ShellStore = Stored & {
  set: (patch: Partial<Stored>) => void;
};

export const useShellStore = create<ShellStore>((set, get) => ({
  ...load(),
  set: (patch) => {
    set(patch);
    const { timeZone, locked, autoHide, quickLaunch, showClock } = { ...get(), ...patch };
    save({ timeZone, locked, autoHide, quickLaunch, showClock });
  },
}));

/** The zone the clock draws in: the setting, or what the browser reports. */
export const effectiveZone = (zone: string): string =>
  zone === "auto" ? Intl.DateTimeFormat().resolvedOptions().timeZone : zone;
