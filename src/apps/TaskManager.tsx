import { useEffect, useMemo, useRef, useState } from "react";
import { useWindowStore, type WindowState } from "../store/windowStore";
import { STOP_ERRORS, useSessionStore } from "../store/sessionStore";
import { confirmDialog, errorDialog } from "../store/dialogStore";
import { apps, type AppId } from "../apps/registry";
import { run } from "../fs/run";
import { MenuBar } from "../components/MenuBar";
import styles from "./TaskManager.module.css";

type Props = { windowId?: string };
type Tab = "applications" | "processes" | "performance" | "networking";

/* Windows Task Manager, the most opened window in XP after Explorer.
 *
 * Applications is real: the windows on this desktop, and End Task closes
 * one. Processes is half real: one row per window under the name its
 * program had (notepad.exe, mspaint.exe - and the Picture Viewer really was
 * rundll32.exe), on top of the system processes every XP machine showed,
 * which are here because a Processes tab without svchost.exe four times is
 * not the Processes tab. CPU is measured, in the only way a web page can:
 * how late the frames are.
 *
 * Ending csrss.exe does what it did.
 */

/* What each program was called in the Processes tab. Explorer's windows are
 * all one explorer.exe, like the real thing, so they are not listed here. */
const IMAGE_NAMES: Partial<Record<AppId, string>> = {
  notepad: "notepad.exe",
  calculator: "calc.exe",
  paint: "mspaint.exe",
  commandPrompt: "cmd.exe",
  solitaire: "sol.exe",
  minesweeper: "winmine.exe",
  mediaPlayer: "wmplayer.exe",
  imageViewer: "rundll32.exe",
  pdfReader: "AcroRd32.exe",
  internetExplorer: "iexplore.exe",
  displayProperties: "rundll32.exe",
  systemProperties: "rundll32.exe",
  about: "winver.exe",
  taskManager: "taskmgr.exe",
};

type Proc = {
  name: string;
  user: string;
  /** Baseline memory in K; jitters around it. */
  mem: number;
  /** Ends by crashing the machine, by refusing, or by closing a window. */
  kind: "critical" | "system" | "app" | "idle";
  windowId?: string;
};

const SYSTEM_PROCS: Proc[] = [
  { name: "System Idle Process", user: "SYSTEM", mem: 28, kind: "idle" },
  { name: "System", user: "SYSTEM", mem: 236, kind: "critical" },
  { name: "smss.exe", user: "SYSTEM", mem: 388, kind: "critical" },
  { name: "csrss.exe", user: "SYSTEM", mem: 3_912, kind: "critical" },
  { name: "winlogon.exe", user: "SYSTEM", mem: 4_140, kind: "critical" },
  { name: "services.exe", user: "SYSTEM", mem: 3_620, kind: "system" },
  { name: "lsass.exe", user: "SYSTEM", mem: 1_284, kind: "system" },
  { name: "svchost.exe", user: "SYSTEM", mem: 4_976, kind: "system" },
  { name: "svchost.exe", user: "NETWORK SERVICE", mem: 4_212, kind: "system" },
  { name: "svchost.exe", user: "SYSTEM", mem: 21_508, kind: "system" },
  { name: "svchost.exe", user: "LOCAL SERVICE", mem: 3_640, kind: "system" },
  { name: "spoolsv.exe", user: "SYSTEM", mem: 4_868, kind: "system" },
  { name: "explorer.exe", user: "User", mem: 18_320, kind: "system" },
];

const K = (n: number) => `${Math.round(n).toLocaleString("en-US")} K`;

/* CPU, as a web page can know it: frames that arrive late mean the main
 * thread was busy. Sampled every second into sixty points of history, with a
 * floor of a few percent so the graph is never a flat line - the real one
 * never was either. */
function useCpu(windows: number): { now: number; history: number[] } {
  const [state, setState] = useState({ now: 3, history: Array<number>(60).fill(0) });
  const frames = useRef<number[]>([]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const onFrame = (t: number) => {
      frames.current.push(t - last);
      last = t;
      raf = requestAnimationFrame(onFrame);
    };
    raf = requestAnimationFrame(onFrame);

    const timer = setInterval(() => {
      const samples = frames.current;
      frames.current = [];
      const avg = samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : 16.7;
      const busy = Math.max(0, Math.min(100, ((avg - 16.7) / 16.7) * 100));
      const floor = 2 + windows * 1.5 + Math.random() * 3;
      const now = Math.round(Math.min(100, Math.max(busy, floor)));
      setState((s) => ({ now, history: [...s.history.slice(1), now] }));
    }, 1000);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(timer);
    };
  }, [windows]);

  return state;
}

/* Memory, from the one browser that reports it. Elsewhere, a believable
 * machine of the period. */
function memoryK(): { total: number; used: number } {
  const perf = performance as Performance & {
    memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
  };
  const device = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const total = device ? device * 1024 * 1024 : 523_760;
  const used = perf.memory ? perf.memory.usedJSHeapSize / 1024 + 96_000 : 187_432;
  return { total, used: Math.min(used, total * 0.9) };
}

function Graph({ history, max = 100, className }: { history: number[]; max?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const w = (canvas.width = canvas.clientWidth);
    const h = (canvas.height = canvas.clientHeight);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    /* The grid: dark green, twelve pixels, and it scrolls with the data on
     * the real one, which nobody misses. */
    ctx.strokeStyle = "#004000";
    ctx.lineWidth = 1;
    for (let x = 0.5; x < w; x += 12) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0.5; y < h; y += 12) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 1;
    ctx.beginPath();
    history.forEach((v, i) => {
      const x = (i / (history.length - 1)) * w;
      const y = h - (v / max) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }, [history, max]);
  return <canvas ref={ref} className={className} />;
}

export function TaskManager({ windowId }: Props) {
  const windows = useWindowStore((s) => s.windows);
  const close = useWindowStore((s) => s.close);
  const focus = useWindowStore((s) => s.focus);
  const crash = useSessionStore((s) => s.crash);
  const logOff = useSessionStore((s) => s.logOff);
  const askTurnOff = useSessionStore((s) => s.askTurnOff);

  const [tab, setTab] = useState<Tab>("applications");
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [selectedProc, setSelectedProc] = useState<number | null>(null);
  /* The jitter that makes the numbers look measured. Re-rolled every second
   * alongside the CPU sample. */
  const [tick, setTick] = useState(0);

  const cpu = useCpu(windows.length);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const procs = useMemo<Proc[]>(() => {
    const own = windows
      .filter((w) => IMAGE_NAMES[w.appId as AppId])
      .map((w) => ({
        name: IMAGE_NAMES[w.appId as AppId]!,
        user: "User",
        mem: 2_400 + w.title.length * 180 + (w.appId.length * 977) % 9_000,
        kind: "app" as const,
        windowId: w.id,
      }));
    return [...SYSTEM_PROCS, ...own];
  }, [windows]);

  /* Per-row CPU and memory for this second, deterministic in `tick` so the
   * table does not flicker between renders inside one second. */
  const rows = useMemo(() => {
    const seed = tick * 7919;
    const noise = (i: number, span: number) => ((Math.sin(seed + i * 131) + 1) / 2) * span;
    let spent = 0;
    const list = procs.map((p, i) => {
      let cpuShare = 0;
      if (p.kind === "app") cpuShare = Math.round(noise(i, Math.max(1, cpu.now / 2)));
      else if (p.kind === "system" && noise(i, 1) > 0.8) cpuShare = 1;
      spent += cpuShare;
      return { ...p, cpu: cpuShare, mem: p.mem + noise(i, p.mem * 0.04) };
    });
    const idle = list.find((p) => p.kind === "idle");
    if (idle) idle.cpu = Math.max(0, 100 - Math.max(spent, cpu.now));
    return list;
  }, [procs, tick, cpu.now]);

  const memory = memoryK();
  const pfHistory = useMemo(
    () => cpu.history.map((v, i) => Math.round((memory.used / memory.total) * 100 + (i % 7) * 0.4 + v * 0.05)),
    [cpu.history, memory.used, memory.total]
  );
  const threads = 380 + procs.length * 9;
  const handles = 8_900 + procs.length * 140;

  const endTask = (id: string) => close(id);

  const endProcess = async (index: number) => {
    const proc = rows[index];
    if (!proc) return;
    if (proc.kind === "idle") {
      void errorDialog("Unable to Terminate Process", "This is a critical system process. Task Manager cannot end this process.");
      return;
    }
    const ok = await confirmDialog(
      "Task Manager Warning",
      "WARNING: Terminating a process can cause undesired results including loss of data and system instability. The process will not be given the chance to save its state or data before it is terminated. Are you sure you want to terminate the process?"
    );
    if (!ok) return;
    if (proc.kind === "app" && proc.windowId) {
      close(proc.windowId);
      setSelectedProc(null);
    } else if (proc.kind === "critical") {
      crash(STOP_ERRORS.critical);
    } else {
      void errorDialog(
        "Unable to Terminate Process",
        "The operation could not be completed.\n\nAccess is denied."
      );
    }
  };

  const tasks: WindowState[] = windows.filter((w) => w.id !== windowId);

  return (
    <div className={styles.app}>
      <MenuBar
        menus={[
          {
            label: "File",
            items: [
              { label: "New Task (Run...)", onClick: () => void run() },
              { label: "Exit Task Manager", onClick: () => windowId && close(windowId) },
            ],
          },
          {
            label: "Options",
            items: [{ label: "Always On Top", onClick: () => {}, disabled: true }],
          },
          {
            label: "View",
            items: [{ label: "Refresh Now", onClick: () => setTick((n) => n + 1) }],
          },
          {
            label: "Shut Down",
            items: [
              { label: "Log Off User", onClick: logOff },
              { label: "Turn Off", onClick: askTurnOff },
            ],
          },
          {
            label: "Help",
            items: [
              {
                label: "About Task Manager",
                onClick: () =>
                  void errorDialog(
                    "About Task Manager",
                    "funOS Task Manager\n\nApplications are the windows on this desktop. Processes are those, plus the ones every XP machine had. CPU is how late the frames are arriving, which is the only thing a web page can measure."
                  ),
              },
            ],
          },
        ]}
      />

      <div className={styles.tabs}>
        {(
          [
            ["applications", "Applications"],
            ["processes", "Processes"],
            ["performance", "Performance"],
            ["networking", "Networking"],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? `${styles.tab} ${styles.active}` : styles.tab}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={styles.page}>
        {tab === "applications" && (
          <>
            <div className={styles.list} onMouseDown={() => setSelectedTask(null)}>
              <div className={styles.headerRow}>
                <span>Task</span>
                <span>Status</span>
              </div>
              {tasks.map((w) => {
                const Icon = apps[w.appId as AppId]?.icon;
                return (
                  <button
                    key={w.id}
                    type="button"
                    className={selectedTask === w.id ? `${styles.row} ${styles.selected}` : styles.row}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setSelectedTask(w.id);
                    }}
                    onDoubleClick={() => focus(w.id)}
                  >
                    <span className={styles.cellName}>
                      {Icon && <Icon size={16} />}
                      <span className={styles.ellipsis}>{w.title}</span>
                    </span>
                    <span>Running</span>
                  </button>
                );
              })}
            </div>
            <div className={styles.buttons}>
              <button type="button" disabled={!selectedTask} onClick={() => selectedTask && endTask(selectedTask)}>
                End Task
              </button>
              <button type="button" disabled={!selectedTask} onClick={() => selectedTask && focus(selectedTask)}>
                Switch To
              </button>
              <button type="button" onClick={() => void run()}>
                New Task...
              </button>
            </div>
          </>
        )}

        {tab === "processes" && (
          <>
            <div className={styles.list} onMouseDown={() => setSelectedProc(null)}>
              <div className={`${styles.headerRow} ${styles.procHeader}`}>
                <span>Image Name</span>
                <span>User Name</span>
                <span className={styles.num}>CPU</span>
                <span className={styles.num}>Mem Usage</span>
              </div>
              {rows.map((p, i) => (
                <button
                  key={`${p.name}-${p.windowId ?? i}`}
                  type="button"
                  className={
                    selectedProc === i ? `${styles.row} ${styles.procRow} ${styles.selected}` : `${styles.row} ${styles.procRow}`
                  }
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setSelectedProc(i);
                  }}
                >
                  <span className={styles.ellipsis}>{p.name}</span>
                  <span className={styles.ellipsis}>{p.user}</span>
                  <span className={styles.num}>{String(p.cpu).padStart(2, "0")}</span>
                  <span className={styles.num}>{K(p.mem)}</span>
                </button>
              ))}
            </div>
            <div className={styles.buttons}>
              <span className={styles.check}>
                <input type="checkbox" id="tm-all-users" checked readOnly />
                <label htmlFor="tm-all-users">Show processes from all users</label>
              </span>
              <button type="button" disabled={selectedProc === null} onClick={() => selectedProc !== null && void endProcess(selectedProc)}>
                End Process
              </button>
            </div>
          </>
        )}

        {tab === "performance" && (
          <div className={styles.perf}>
            <div className={styles.perfRow}>
              <fieldset className={styles.group}>
                <legend>CPU Usage</legend>
                <div className={styles.meter}>{cpu.now} %</div>
              </fieldset>
              <fieldset className={`${styles.group} ${styles.grow}`}>
                <legend>CPU Usage History</legend>
                <Graph history={cpu.history} className={styles.graph} />
              </fieldset>
            </div>
            <div className={styles.perfRow}>
              <fieldset className={styles.group}>
                <legend>PF Usage</legend>
                <div className={styles.meter}>{Math.round(memory.used / 1024)} MB</div>
              </fieldset>
              <fieldset className={`${styles.group} ${styles.grow}`}>
                <legend>Page File Usage History</legend>
                <Graph history={pfHistory} className={styles.graph} />
              </fieldset>
            </div>
            <div className={styles.perfRow}>
              <fieldset className={`${styles.group} ${styles.grow}`}>
                <legend>Totals</legend>
                <dl className={styles.stats}>
                  <dt>Handles</dt><dd>{handles.toLocaleString("en-US")}</dd>
                  <dt>Threads</dt><dd>{threads.toLocaleString("en-US")}</dd>
                  <dt>Processes</dt><dd>{procs.length}</dd>
                </dl>
              </fieldset>
              <fieldset className={`${styles.group} ${styles.grow}`}>
                <legend>Physical Memory (K)</legend>
                <dl className={styles.stats}>
                  <dt>Total</dt><dd>{Math.round(memory.total).toLocaleString("en-US")}</dd>
                  <dt>Available</dt><dd>{Math.round(memory.total - memory.used).toLocaleString("en-US")}</dd>
                  <dt>System Cache</dt><dd>{Math.round(memory.total * 0.31).toLocaleString("en-US")}</dd>
                </dl>
              </fieldset>
            </div>
            <div className={styles.perfRow}>
              <fieldset className={`${styles.group} ${styles.grow}`}>
                <legend>Commit Charge (K)</legend>
                <dl className={styles.stats}>
                  <dt>Total</dt><dd>{Math.round(memory.used).toLocaleString("en-US")}</dd>
                  <dt>Limit</dt><dd>{Math.round(memory.total * 2.4).toLocaleString("en-US")}</dd>
                  <dt>Peak</dt><dd>{Math.round(memory.used * 1.18).toLocaleString("en-US")}</dd>
                </dl>
              </fieldset>
              <fieldset className={`${styles.group} ${styles.grow}`}>
                <legend>Kernel Memory (K)</legend>
                <dl className={styles.stats}>
                  <dt>Total</dt><dd>{(42_116).toLocaleString("en-US")}</dd>
                  <dt>Paged</dt><dd>{(31_884).toLocaleString("en-US")}</dd>
                  <dt>Nonpaged</dt><dd>{(10_232).toLocaleString("en-US")}</dd>
                </dl>
              </fieldset>
            </div>
          </div>
        )}

        {tab === "networking" && (
          <div className={styles.perf}>
            <fieldset className={`${styles.group} ${styles.grow}`}>
              <legend>Local Area Connection</legend>
              <Graph history={cpu.history.map((v) => Math.min(100, v * 0.1))} className={styles.graphTall} />
            </fieldset>
            <div className={styles.list}>
              <div className={`${styles.headerRow} ${styles.netHeader}`}>
                <span>Adapter Name</span>
                <span>Network Utilization</span>
                <span>Link Speed</span>
                <span>State</span>
              </div>
              <div className={`${styles.row} ${styles.netRow}`}>
                <span>Local Area Connection</span>
                <span>{(cpu.now * 0.1).toFixed(2)} %</span>
                <span>100 Mbps</span>
                <span>Operational</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={styles.status}>
        <span>Processes: {procs.length}</span>
        <span>CPU Usage: {cpu.now}%</span>
        <span>
          Commit Charge: {Math.round(memory.used / 1024)}M / {Math.round((memory.total * 2.4) / 1024)}M
        </span>
      </div>
    </div>
  );
}
