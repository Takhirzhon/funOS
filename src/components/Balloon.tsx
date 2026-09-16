import { useLayoutEffect, useRef } from "react";
import { useBalloonStore } from "../store/balloonStore";
import { InfoIcon } from "../icons";
import styles from "./Balloon.module.css";

export function Balloon() {
  const current = useBalloonStore((s) => s.current);
  const dismiss = useBalloonStore((s) => s.dismiss);
  /* Where the tail goes: the middle of the icon the balloon is about,
   * measured from the right edge of the screen, since that is the edge the
   * balloon is placed from. The clock when the icon is not on the bar.
   * Written straight onto the two tail elements: it is a measurement of
   * the page, not state. */
  const tailRef = useRef<HTMLSpanElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    if (!current) return;
    const el =
      document.querySelector<HTMLElement>(`[data-tray="${current.anchor ?? "clock"}"]`) ??
      document.querySelector<HTMLElement>('[data-tray="clock"]');
    if (!el) return;
    const r = el.getBoundingClientRect();
    const fromRight = document.documentElement.clientWidth - (r.left + r.width / 2);
    /* The balloon is ten pixels in from the edge and the tail nine to its
     * point; keep the point on the balloon. */
    const right = `${Math.max(16, Math.min(240, fromRight - 10 - 9))}px`;
    if (tailRef.current) tailRef.current.style.right = right;
    if (fillRef.current) fillRef.current.style.right = right;
  }, [current]);

  if (!current) return null;

  return (
    /* Keyed on the balloon's id so a replacement re-plays the entrance
     * animation instead of silently swapping its text. */
    <div
      key={current.id}
      className={styles.balloon}
      role="status"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <span className={styles.tail} ref={tailRef} />
      <span className={styles.tailFill} ref={fillRef} />

      <div className={styles.head}>
        <InfoIcon size={16} />
        <span className={styles.title}>{current.title}</span>
        <button type="button" className={styles.close} onClick={dismiss} aria-label="Close">
          ✕
        </button>
      </div>
      <div className={styles.body}>{current.body}</div>
    </div>
  );
}
