import { create } from "zustand";
import { playSound } from "./soundStore";
import { useWindowStore } from "./windowStore";

/* The machine every screen before the desktop belongs to.
 *
 *   boot     the black screen with the progress blocks
 *   login    the blue welcome screen with the user tile
 *   desktop  the actual thing
 *   goodbye  "It is now safe to turn off your computer."
 *
 * One store rather than a flag per screen, because these are states of one
 * session and only one can be true. Two booleans would allow "shutting down
 * while logged out", which is not a thing.
 */
export type Phase = "boot" | "login" | "desktop" | "goodbye" | "crash";

/* A stop error: the code and the name it was known by. Two of the ones
 * people actually saw. */
export type StopError = { code: string; name: string; params: string };

export const STOP_ERRORS = {
  /* The everyday one - a bad driver, a bad stick of RAM, a Tuesday. */
  irql: {
    code: "0x0000000A",
    name: "IRQL_NOT_LESS_OR_EQUAL",
    params: "(0x00000000, 0x00000002, 0x00000000, 0x804E3E1D)",
  },
  /* What you got for ending csrss.exe in Task Manager, which somebody
   * always tried. */
  critical: {
    code: "0x000000F4",
    name: "CRITICAL_OBJECT_TERMINATION",
    params: "(0x00000003, 0x8A1B2C40, 0x8A1B2DB4, 0x805D22DA)",
  },
} satisfies Record<string, StopError>;

const SEEN_KEY = "funos.booted";

/* The boot sequence plays once per browser tab, not once per page load.
 *
 * It is two seconds of nostalgia the first time and two seconds of friction
 * every time after that, and the reload that matters most is the one somebody
 * does because something broke. sessionStorage draws that line exactly:
 * a new tab boots, a refresh does not.
 */
const alreadyBooted = (): boolean => {
  try {
    return sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
};

const rememberBoot = () => {
  try {
    sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* Private mode. Booting twice is not worth an error. */
  }
};

type SessionStore = {
  phase: Phase;
  /** Which stop error the blue screen shows. Meaningless outside "crash". */
  stop: StopError;
  /** True while the shutdown dialog is up, which dims the desktop behind it. */
  turningOff: boolean;
  finishBoot: () => void;
  logIn: () => void;
  logOff: () => void;
  askTurnOff: () => void;
  cancelTurnOff: () => void;
  turnOff: () => void;
  restart: () => void;
  /** Blue screen. Every window is gone - that is what a crash was. */
  crash: (stop?: StopError) => void;
};

export const useSessionStore = create<SessionStore>((set) => ({
  phase: alreadyBooted() ? "login" : "boot",
  stop: STOP_ERRORS.irql,
  turningOff: false,

  crash: (stop = STOP_ERRORS.irql) => {
    useWindowStore.setState({ windows: [], focusedId: null });
    set({ phase: "crash", stop, turningOff: false });
  },

  finishBoot: () => {
    rememberBoot();
    set({ phase: "login" });
  },

  /* Clicking the user tile is the first gesture on the page, which is exactly
   * when a browser will let an AudioContext start - so the startup chime can
   * only ever play here, and here is where it belongs anyway. */
  logIn: () => {
    playSound("startup");
    set({ phase: "desktop", turningOff: false });
  },
  logOff: () => set({ phase: "login", turningOff: false }),

  askTurnOff: () => set({ turningOff: true }),
  cancelTurnOff: () => set({ turningOff: false }),

  turnOff: () => {
    playSound("shutdown");
    set({ phase: "goodbye", turningOff: false });
  },

  /* Restart replays the boot screen, so it has to clear the once-per-tab flag
   * as well as the phase - otherwise "Restart" would drop straight to the login
   * screen, which is the one thing it is not. */
  restart: () => {
    try {
      sessionStorage.removeItem(SEEN_KEY);
    } catch {
      /* As above. */
    }
    set({ phase: "boot", turningOff: false });
  },
}));
