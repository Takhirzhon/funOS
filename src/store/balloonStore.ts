import { create } from "zustand";
import { playSound } from "./soundStore";

/* Balloon tips - the things that popped out of the tray to tell you about
 * unused desktop icons.
 *
 * One at a time, on purpose. Two balloons stacking is not something XP could
 * do, and a queue would let a chatty caller bury a message that mattered
 * behind three that did not. A new balloon replaces the old one, which is both
 * simpler and what the original did.
 */
export type Balloon = {
  id: number;
  title: string;
  body: string;
  /** Which tray icon it points at, so the tail lands under the right one. */
  anchor?: string;
};

type BalloonStore = {
  current: Balloon | null;
  show: (title: string, body: string, anchor?: string) => void;
  dismiss: () => void;
};

let nextId = 0;
let hideTimer: ReturnType<typeof setTimeout> | undefined;

export const useBalloonStore = create<BalloonStore>((set) => ({
  current: null,

  show: (title, body, anchor) => {
    clearTimeout(hideTimer);
    const id = (nextId += 1);
    set({ current: { id, title, body, anchor } });
    playSound("notify");
    /* Ten seconds, which is XP's. Long enough to read twice and short enough
     * that an ignored balloon goes away on its own. */
    hideTimer = setTimeout(() => {
      set((s) => (s.current?.id === id ? { current: null } : s));
    }, 10_000);
  },

  dismiss: () => {
    clearTimeout(hideTimer);
    set({ current: null });
  },
}));

export const showBalloon = (title: string, body: string, anchor?: string) =>
  useBalloonStore.getState().show(title, body, anchor);
