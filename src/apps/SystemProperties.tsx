import { useEffect, useState } from "react";
import { useWindowStore } from "../store/windowStore";
import { StartLogoIcon } from "../icons";
import styles from "./SystemProperties.module.css";

type Props = { windowId?: string };
type Tab = "general" | "computerName" | "hardware" | "advanced";

/* System Properties - right-click My Computer, Properties. The General tab
 * is the one anybody opened: the version, who the machine is registered to,
 * the processor and the RAM. It is two hundred lines that make the computer
 * somebody's.
 *
 * Everything on it is true. The build is what /health reports, which is the
 * commit the server was built from; the processor count and memory are what
 * the browser is willing to say about the machine it is running on.
 */

const OWNER = { name: "Tokhirzhon Tashmatov", org: "Bishkek, Kyrgyzstan" };

/* XP's product ID was five groups of digits nobody ever read. This one reads
 * as one until you look, and then it says what it is. */
const PRODUCT_ID = "55274-OEM-2026-FUNOS";

/* The browser's best guess at the hardware. `deviceMemory` is Chrome-only
 * and rounds to a power of two; the rest use the CPU count, which every
 * browser reports, and admit the rest. */
function describeMachine(): { cpu: string; ram: string } {
  const cores = navigator.hardwareConcurrency || 1;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return {
    cpu: `${cores} logical processor${cores === 1 ? "" : "s"}`,
    ram: memory ? `about ${memory} GB of RAM` : "RAM not reported by this browser",
  };
}

function useBuild(): string {
  const [build, setBuild] = useState("checking...");
  useEffect(() => {
    let cancelled = false;
    fetch("/health")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { version?: string }) => {
        if (!cancelled) setBuild(j.version ? `Build ${j.version.slice(0, 7)}` : "Build unknown");
      })
      .catch(() => {
        if (!cancelled) setBuild("Development build");
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return build;
}

export function SystemProperties({ windowId }: Props) {
  const close = useWindowStore((s) => s.close);
  const [tab, setTab] = useState<Tab>("general");
  const build = useBuild();
  const machine = describeMachine();

  const tabs: [Tab, string][] = [
    ["general", "General"],
    ["computerName", "Computer Name"],
    ["hardware", "Hardware"],
    ["advanced", "Advanced"],
  ];

  return (
    <div className={styles.app}>
      <div className={styles.tabs}>
        {tabs.map(([id, label]) => (
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
        {tab === "general" && (
          <div className={styles.general}>
            <div className={styles.logo}>
              <StartLogoIcon size={64} />
              <div className={styles.logoText}>
                <span className={styles.logoBrand}>funOS</span>
                <span className={styles.logoEdition}>Professional</span>
              </div>
            </div>

            <dl className={styles.groups}>
              <dt>System:</dt>
              <dd>
                funOS Professional
                <br />
                Version 2026
                <br />
                {build}
              </dd>

              <dt>Registered to:</dt>
              <dd>
                {OWNER.name}
                <br />
                {OWNER.org}
                <br />
                <span className={styles.productId}>{PRODUCT_ID}</span>
              </dd>

              <dt>Computer:</dt>
              <dd>
                Web Browser Virtual Machine
                <br />
                {machine.cpu}
                <br />
                {machine.ram}
                <br />
                {screen.width}&times;{screen.height}, {window.devicePixelRatio}x
              </dd>
            </dl>
          </div>
        )}

        {tab === "computerName" && (
          <div className={styles.plain}>
            <p className={styles.blurb}>Windows uses the following information to identify your computer on the network.</p>
            <dl className={styles.groups}>
              <dt>Computer description:</dt>
              <dd>Tokhirzhon&rsquo;s portfolio</dd>
              <dt>Full computer name:</dt>
              <dd>khirokhito.tech</dd>
              <dt>Workgroup:</dt>
              <dd>INTERNET</dd>
            </dl>
            <p className={styles.blurb}>
              To rename this computer or join a domain, click Change. <button type="button" disabled>Change...</button>
            </p>
          </div>
        )}

        {tab === "hardware" && (
          <div className={styles.plain}>
            <p className={styles.blurb}>
              <b>Device Manager</b>
              <br />
              The Device Manager lists all the hardware devices installed on your computer. There is one: the
              browser you are reading this in, and it is working properly.
            </p>
            <p className={styles.blurb}>
              <button type="button" disabled>Device Manager</button>
            </p>
            <p className={styles.blurb}>
              <b>User agent</b>
              <br />
              <span className={styles.mono}>{navigator.userAgent}</span>
            </p>
          </div>
        )}

        {tab === "advanced" && (
          <div className={styles.plain}>
            <p className={styles.blurb}>You must be logged on as an Administrator to make most of these changes.</p>
            <p className={styles.blurb}>
              <b>Performance</b>
              <br />
              Visual effects, processor scheduling, memory usage, and virtual memory.{" "}
              <button type="button" disabled>Settings</button>
            </p>
            <p className={styles.blurb}>
              <b>Startup and Recovery</b>
              <br />
              System startup, system failure, and debugging information.{" "}
              <button type="button" disabled>Settings</button>
            </p>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <button type="button" onClick={() => windowId && close(windowId)} autoFocus>
          OK
        </button>
        <button type="button" onClick={() => windowId && close(windowId)}>
          Cancel
        </button>
        <button type="button" disabled>
          Apply
        </button>
      </div>
    </div>
  );
}
