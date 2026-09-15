import { useSyncExternalStore } from "react";

/* The two facts about the device the shell adapts to.
 *
 * Not "is this a phone" - there is no such query, and a tablet in a window or
 * a laptop with a touch screen would give the wrong answer either way. Two
 * separate questions, each answered by the browser:
 *
 *   compact  - is there room for a 660px Explorer window next to anything?
 *              Below this, windows open maximized and Explorer drops its tree.
 *   coarse   - is the pointer a finger? Then a tap opens, because a double
 *              tap is a zoom gesture first and a double click a distant
 *              second. XP had this as "Single-click to open an item" in
 *              Folder Options; here it is decided by the hardware.
 */
export const COMPACT = "(max-width: 700px)";
export const COARSE = "(pointer: coarse)";

/** For code outside React - the window store deciding how big to open. */
export const matches = (query: string): boolean =>
  typeof window !== "undefined" && window.matchMedia(query).matches;

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}
