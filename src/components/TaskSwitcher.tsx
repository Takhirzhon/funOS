import { useEffect, useMemo, useRef, useState } from "react";
import { useWindowStore } from "../store/windowStore";
import { apps, type AppId } from "../apps/registry";
import styles from "./TaskSwitcher.module.css";

/* Alt+Tab, and the keyboard shortcuts that belong to the window manager rather
 * than to any one window.
 *
 * A caveat worth knowing before filing a bug: on Windows, **Alt+Tab and Alt+F4
 * never reach the page**. The host window manager claims both before the
 * browser sees the event, and no amount of preventDefault changes that. They
 * are wired up anyway - they do work on some Linux desktops and in kiosk mode,
 * and cost nothing when they do not - but the shortcut that always works is
 * Ctrl+Alt+Left/Right, which nothing else has claimed.
 */
export function TaskSwitcher() {
  const windows = useWindowStore((s) => s.windows);
  const focus = useWindowStore((s) => s.focus);
  const close = useWindowStore((s) => s.close);
  const [index, setIndex] = useState<number | null>(null);

  /* Most-recently-used order, which zIndex already encodes: focusing a window
   * raises it, so sorting by zIndex descending is the MRU stack for free. */
  const order = useMemo(
    () => [...windows].filter((w) => !w.minimized).sort((a, b) => b.zIndex - a.zIndex),
    [windows]
  );

  const orderRef = useRef(order);
  const indexRef = useRef<number | null>(null);
  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  useEffect(() => {
    const set = (value: number | null) => {
      indexRef.current = value;
      setIndex(value);
    };

    const advance = (delta: number) => {
      const list = orderRef.current;
      if (list.length === 0) return;
      const current = indexRef.current;
      /* The first press goes to the *second* window, not the first: Alt+Tab
       * means "the other one", and landing back on the window you are already
       * in would make the common case do nothing. */
      const next =
        current === null
          ? delta > 0
            ? Math.min(1, list.length - 1)
            : list.length - 1
          : (current + delta + list.length) % list.length;
      set(next);
    };

    const commit = () => {
      const current = indexRef.current;
      if (current === null) return;
      const target = orderRef.current[current];
      set(null);
      if (target) focus(target.id);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === "Tab") {
        e.preventDefault();
        advance(e.shiftKey ? -1 : 1);
        return;
      }
      if (e.altKey && e.key === "F4") {
        e.preventDefault();
        const focused = useWindowStore.getState().focusedId;
        if (focused) close(focused);
        return;
      }
      /* The one that is guaranteed to arrive. No overlay: it is an immediate
       * cycle, so there is nothing to hold open. */
      if (e.ctrlKey && e.altKey && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
        e.preventDefault();
        const list = orderRef.current;
        if (list.length < 2) return;
        const step = e.key === "ArrowRight" ? 1 : -1;
        const from = list.findIndex((w) => w.id === useWindowStore.getState().focusedId);
        const next = ((from === -1 ? 0 : from) + step + list.length) % list.length;
        focus(list[next].id);
        return;
      }
      if (e.key === "Escape" && indexRef.current !== null) {
        e.preventDefault();
        set(null);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Alt") commit();
    };

    /* Losing the window mid-chord leaves the box on screen for ever, because
     * the keyup that would have closed it goes somewhere else. */
    const onBlur = () => set(null);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [close, focus]);

  if (index === null || order.length === 0) return null;

  const selected = order[Math.min(index, order.length - 1)];

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <div className={styles.icons}>
          {order.map((w, i) => {
            const Icon = apps[w.appId as AppId]?.icon;
            return (
              <div
                key={w.id}
                className={i === index ? `${styles.slot} ${styles.active}` : styles.slot}
              >
                {Icon && <Icon size={32} />}
              </div>
            );
          })}
        </div>
        <div className={styles.caption}>{selected?.title}</div>
      </div>
    </div>
  );
}
