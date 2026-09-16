import { useEffect, useState } from "react";
import { effectiveZone, useShellStore } from "../store/shellStore";
import { useWindowStore } from "../store/windowStore";
import { apps } from "../apps/registry";
import styles from "./Taskbar.module.css";

/* "1:23 PM", in the zone Date and Time Properties chose. */
const fmt = (d: Date, zone: string) => {
  try {
    return d.toLocaleTimeString("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit" });
  } catch {
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
};

/* The clock draws no background of its own: it sits inside the tray, and the
 * tray owns the recessed band. It used to paint its own gradient, which is why
 * there was a visible seam where the two blues met.
 */
export function Clock() {
  const [now, setNow] = useState(() => new Date());
  const zone = effectiveZone(useShellStore((s) => s.timeZone));
  const open = useWindowStore((s) => s.open);

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
    /* Double-clicking the clock opened Date and Time Properties. It still
       does; it is the one way most people ever found that dialog. */
    <div
      className={styles.clock}
      title={now.toLocaleDateString("en-US", { dateStyle: "full", timeZone: zone })}
      onDoubleClick={() => open("dateTime", { title: apps.dateTime.title, bounds: apps.dateTime.defaultSize })}
    >
      {fmt(now, zone)}
    </div>
  );
}
