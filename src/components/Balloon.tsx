import { useBalloonStore } from "../store/balloonStore";
import { InfoIcon } from "../icons";
import styles from "./Balloon.module.css";

export function Balloon() {
  const current = useBalloonStore((s) => s.current);
  const dismiss = useBalloonStore((s) => s.dismiss);

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
      <span className={styles.tail} />
      <span className={styles.tailFill} />

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
