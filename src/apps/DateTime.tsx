import { useEffect, useRef, useState } from "react";
import { useWindowStore } from "../store/windowStore";
import { effectiveZone, useShellStore } from "../store/shellStore";
import { errorDialog } from "../store/dialogStore";
import styles from "./DateTime.module.css";

type Props = { windowId?: string };
type Tab = "date" | "zone" | "internet";

/* Date and Time Properties: the calendar, the analog clock that ticked, the
 * time zone list, and the Internet Time tab that synchronised with
 * time.windows.com. The clock is the visitor's computer's; the one thing to
 * set is the zone it is shown in, and the taskbar clock follows.
 */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* Every zone the browser knows, or a short list where it will not say. */
const zones = (): string[] => {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (k: string) => string[] };
  try {
    const all = intl.supportedValuesOf?.("timeZone");
    if (all && all.length) return all;
  } catch {
    /* Older engine. */
  }
  return ["UTC", "Europe/London", "Europe/Berlin", "Europe/Moscow", "Asia/Bishkek", "Asia/Tashkent", "Asia/Tokyo", "America/New_York", "America/Los_Angeles"];
};

/* "(GMT+06:00) Asia/Bishkek", the way the list read. */
function zoneLabel(zone: string, at: Date): string {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName")?.value;
    const off = part === "GMT" ? "GMT+00:00" : (part ?? "");
    return `(${off}) ${zone.replace(/_/g, " ")}`;
  } catch {
    return zone;
  }
}

function partsIn(zone: string, at: Date) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  }).formatToParts(at);
  const n = (t: string) => Number(f.find((p) => p.type === t)?.value ?? 0);
  return { year: n("year"), month: n("month") - 1, day: n("day"), hour: n("hour") % 24, minute: n("minute"), second: n("second") };
}

function AnalogClock({ hour, minute, second }: { hour: number; minute: number; second: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const s = (c.width = c.height = 120);
    const r = s / 2;
    ctx.clearRect(0, 0, s, s);
    /* The face: a pale disc with a dark rim, and twelve ticks. */
    const g = ctx.createRadialGradient(r - 20, r - 20, 10, r, r, r);
    g.addColorStop(0, "#fff");
    g.addColorStop(1, "#d8dde8");
    ctx.beginPath();
    ctx.arc(r, r, r - 3, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#1c3f7a";
    ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(r + Math.sin(a) * (r - 8), r - Math.cos(a) * (r - 8));
      ctx.lineTo(r + Math.sin(a) * (r - 14), r - Math.cos(a) * (r - 14));
      ctx.strokeStyle = "#000";
      ctx.lineWidth = i % 3 === 0 ? 3 : 1.5;
      ctx.stroke();
    }
    const hand = (angle: number, len: number, width: number, color: string) => {
      ctx.beginPath();
      ctx.moveTo(r, r);
      ctx.lineTo(r + Math.sin(angle) * len, r - Math.cos(angle) * len);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.stroke();
    };
    hand(((hour % 12) + minute / 60) / 12 * Math.PI * 2, r - 30, 4, "#000");
    hand((minute + second / 60) / 60 * Math.PI * 2, r - 18, 3, "#000");
    hand((second / 60) * Math.PI * 2, r - 14, 1.5, "#c00");
    ctx.beginPath();
    ctx.arc(r, r, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#000";
    ctx.fill();
  }, [hour, minute, second]);
  return <canvas ref={ref} className={styles.clock} />;
}

export function DateTime({ windowId }: Props) {
  const close = useWindowStore((s) => s.close);
  const timeZone = useShellStore((s) => s.timeZone);
  const setShell = useShellStore((s) => s.set);
  const [tab, setTab] = useState<Tab>("date");
  const [now, setNow] = useState(() => new Date());
  const [synced, setSynced] = useState<string | null>(null);
  const [zoneList] = useState(zones);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const zone = effectiveZone(timeZone);
  const p = partsIn(zone, now);
  const first = new Date(Date.UTC(p.year, p.month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(p.year, p.month + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array<null>(first).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const done = () => windowId && close(windowId);

  return (
    <div className={styles.app}>
      <div className={styles.tabs}>
        {(
          [
            ["date", "Date & Time"],
            ["zone", "Time Zone"],
            ["internet", "Internet Time"],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? `${styles.tab} ${styles.active}` : styles.tab} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      <div className={styles.page}>
        {tab === "date" && (
          <div className={styles.dateRow}>
            <fieldset className={styles.group}>
              <legend>Date</legend>
              <div className={styles.monthRow}>
                <select value={p.month} disabled>
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i}>
                      {m}
                    </option>
                  ))}
                </select>
                <input type="number" value={p.year} readOnly className={styles.year} />
              </div>
              <div className={styles.calendar}>
                {DAYS.map((d) => (
                  <span key={d} className={styles.dayName}>
                    {d}
                  </span>
                ))}
                {cells.map((d, i) => (
                  <span key={i} className={d === p.day ? `${styles.day} ${styles.today}` : styles.day}>
                    {d ?? ""}
                  </span>
                ))}
              </div>
            </fieldset>
            <fieldset className={styles.group}>
              <legend>Time</legend>
              <AnalogClock hour={p.hour} minute={p.minute} second={p.second} />
              <div className={styles.digital}>
                {String(p.hour % 12 || 12).padStart(2, "0")}:{String(p.minute).padStart(2, "0")}:{String(p.second).padStart(2, "0")}{" "}
                {p.hour >= 12 ? "PM" : "AM"}
              </div>
            </fieldset>
          </div>
        )}
        {tab === "date" && (
          <p className={styles.blurb}>
            Current time zone: {zoneLabel(zone, now)}. The date and time are your computer&rsquo;s; the zone they
            are shown in is on the next tab.
          </p>
        )}

        {tab === "zone" && (
          <>
            <select className={styles.zoneSelect} value={timeZone} onChange={(e) => setShell({ timeZone: e.target.value })}>
              <option value="auto">{zoneLabel(Intl.DateTimeFormat().resolvedOptions().timeZone, now)} (your computer)</option>
              {zoneList.map((z) => (
                <option key={z} value={z}>
                  {zoneLabel(z, now)}
                </option>
              ))}
            </select>
            <div className={styles.map} aria-hidden>
              {/* The world map the tab had, as the one thing that made it
                  worth opening: a night-blue globe with a lit band where the
                  chosen zone is. */}
              <div className={styles.mapBand} /* Offsets run from -12 to +14: twenty-six hours across the map. */
              style={{ left: `${((zoneOffsetHours(zone, now) + 12) / 26) * 100}%` }} />
            </div>
            <div className={styles.check}>
              <input type="checkbox" id="dt-dst" checked readOnly disabled />
              <label htmlFor="dt-dst">Automatically adjust clock for daylight saving changes</label>
            </div>
          </>
        )}

        {tab === "internet" && (
          <>
            <div className={styles.check}>
              <input type="checkbox" id="dt-sync" checked readOnly />
              <label htmlFor="dt-sync">Automatically synchronize with an Internet time server</label>
            </div>
            <div className={styles.serverRow}>
              <span>Server:</span>
              <select defaultValue="time.windows.com">
                <option>time.windows.com</option>
                <option>time.nist.gov</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  /* The clock is the browser's; there is nothing to set. The
                   * message is the one the button gave, because the button
                   * was the point. */
                  const stamp = new Date().toLocaleString();
                  setSynced(stamp);
                  void errorDialog("Date and Time Properties", `The time has been successfully synchronized with time.windows.com on ${stamp}.`);
                }}
              >
                Update Now
              </button>
            </div>
            <p className={styles.blurb}>
              {synced
                ? `The time has been successfully synchronized with time.windows.com on ${synced}.`
                : "Next synchronization: whenever your computer does it. Synchronization can occur only when your computer is connected to the Internet."}
            </p>
          </>
        )}
      </div>

      <div className={styles.footer}>
        <button type="button" onClick={done} autoFocus>
          OK
        </button>
        <button type="button" onClick={done}>
          Cancel
        </button>
        <button type="button" disabled>
          Apply
        </button>
      </div>
    </div>
  );
}

function zoneOffsetHours(zone: string, at: Date): number {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName")?.value;
    const m = /GMT([+-])(\d{2}):(\d{2})/.exec(part ?? "");
    if (!m) return 0;
    return (m[1] === "-" ? -1 : 1) * (Number(m[2]) + Number(m[3]) / 60);
  } catch {
    return 0;
  }
}
