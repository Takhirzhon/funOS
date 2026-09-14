import { useEffect, useState } from "react";
import styles from "./Taskbar.module.css";

const fmt = (d: Date) => {
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
};

/* The clock draws no background of its own: it sits inside the tray, and the
 * tray owns the recessed band. It used to paint its own gradient, which is why
 * there was a visible seam where the two blues met.
 */
export function Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    /* Ticking every 15s rather than every second. The display has minute
     * resolution, so a per-second interval is 59 re-renders an hour that
     * change nothing - and it would still be up to 15s stale at the boundary
     * either way.
     */
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={styles.clock} title={now.toLocaleDateString(undefined, { dateStyle: "full" })}>
      {fmt(now)}
    </div>
  );
}
