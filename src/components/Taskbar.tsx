import { useEffect, useState } from "react";
import { useWindowStore } from "../store/windowStore";
import { useMenuStore } from "../store/menuStore";
import { windowSystemMenu } from "./windowSystemMenu";
import { apps, type AppId } from "../apps/registry";
import { StartButton } from "./StartButton";
import { StartMenu } from "./StartMenu";
import { Clock } from "./Clock";
import {
  IEIcon,
  NetworkIcon,
  ShieldIcon,
  ShowDesktopIcon,
  VolumeIcon,
} from "../icons";
import styles from "./Taskbar.module.css";

export function Taskbar() {
  const windows = useWindowStore((s) => s.windows);
  const focusedId = useWindowStore((s) => s.focusedId);
  const toggleFromTaskbar = useWindowStore((s) => s.toggleFromTaskbar);
  const minimizeAll = useWindowStore((s) => s.minimizeAll);
  const openMenu = useMenuStore((s) => s.open);
  const [startOpen, setStartOpen] = useState(false);

  useEffect(() => {
    if (!startOpen) return;
    const close = () => setStartOpen(false);
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [startOpen]);

  return (
    <>
      {startOpen && <StartMenu onClose={() => setStartOpen(false)} />}
      <div className={styles.bar} onMouseDown={(e) => e.stopPropagation()}>
        <StartButton open={startOpen} onClick={() => setStartOpen((v) => !v)} />

        {/* Quick Launch. XP shipped with it enabled and with exactly these two
         * entries, which is the only reason Show Desktop is here rather than in
         * the tray: it is a Quick Launch shortcut, not a notification.
         */}
        <div className={styles.grip} aria-hidden />
        <div className={styles.quickLaunch}>
          <button
            type="button"
            className={styles.quickButton}
            title="Show the Desktop"
            onClick={minimizeAll}
          >
            <ShowDesktopIcon />
          </button>
          <button
            type="button"
            className={styles.quickButton}
            title="Launch Internet Explorer Browser"
            disabled
          >
            <IEIcon />
          </button>
        </div>
        <div className={styles.grip} aria-hidden />

        <div className={styles.tasks}>
          {windows.map((w) => {
            const active = focusedId === w.id && !w.minimized;
            const Icon = apps[w.appId as AppId]?.icon;
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => toggleFromTaskbar(w.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  openMenu(e.clientX, e.clientY, windowSystemMenu(w));
                }}
                title={w.title}
                className={active ? `${styles.task} ${styles.active}` : styles.task}
              >
                {Icon && (
                  <span className={styles.taskIcon}>
                    <Icon size={16} />
                  </span>
                )}
                <span className={styles.taskLabel}>{w.title}</span>
              </button>
            );
          })}
        </div>

        <div className={styles.tray}>
          <div className={styles.trayIcons}>
            <span className={styles.trayIcon} title="Security Center">
              <ShieldIcon />
            </span>
            <span className={styles.trayIcon} title="Local Area Connection">
              <NetworkIcon />
            </span>
            <span className={styles.trayIcon} title="Volume">
              <VolumeIcon />
            </span>
          </div>
          <Clock />
        </div>
      </div>
    </>
  );
}
