import { useEffect, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useWindowStore } from "../store/windowStore";
import { useMenuStore } from "../store/menuStore";
import { useSoundStore } from "../store/soundStore";
import { showBalloon } from "../store/balloonStore";
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
  VolumeMuteIcon,
} from "../icons";
import styles from "./Taskbar.module.css";

export function Taskbar() {
  const windows = useWindowStore((s) => s.windows);
  const focusedId = useWindowStore((s) => s.focusedId);
  const toggleFromTaskbar = useWindowStore((s) => s.toggleFromTaskbar);
  const minimizeAll = useWindowStore((s) => s.minimizeAll);
  const open = useWindowStore((s) => s.open);
  const cascade = useWindowStore((s) => s.cascade);
  const tile = useWindowStore((s) => s.tile);
  const openMenu = useMenuStore((s) => s.open);
  const soundOn = useSoundStore((s) => s.enabled);
  const toggleSound = useSoundStore((s) => s.toggle);
  const play = useSoundStore((s) => s.play);
  const [startOpen, setStartOpen] = useState(false);

  /* The taskbar's own menu. Everything here acts on every window at once,
   * which is exactly what distinguishes it from the task button's menu. */
  const barMenu = (e: ReactMouseEvent) => {
    e.preventDefault();
    const none = windows.length === 0;
    openMenu(e.clientX, e.clientY, [
      { kind: "item", label: "Cascade Windows", disabled: none, onClick: cascade },
      {
        kind: "item",
        label: "Tile Windows Horizontally",
        disabled: none,
        onClick: () => tile("horizontal"),
      },
      {
        kind: "item",
        label: "Tile Windows Vertically",
        disabled: none,
        onClick: () => tile("vertical"),
      },
      { kind: "separator" },
      { kind: "item", label: "Show the Desktop", disabled: none, onClick: minimizeAll },
      { kind: "separator" },
      { kind: "item", label: "Task Manager", disabled: true },
      { kind: "item", label: "Properties", disabled: true },
    ]);
  };

  useEffect(() => {
    if (!startOpen) return;
    const close = () => setStartOpen(false);
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [startOpen]);

  return (
    <>
      {startOpen && <StartMenu onClose={() => setStartOpen(false)} />}
      <div
        className={styles.bar}
        onMouseDown={(e) => e.stopPropagation()}
        onContextMenu={barMenu}
      >
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
            onClick={() =>
              open("internetExplorer", {
                title: apps.internetExplorer.title,
                bounds: apps.internetExplorer.defaultSize,
              })
            }
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
                  e.stopPropagation();
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
            <button
              type="button"
              className={styles.trayIcon}
              title={soundOn ? "Volume - click to mute" : "Volume - click to unmute"}
              onClick={() => {
                toggleSound();
                /* Played after the toggle, so switching sound *on* is
                 * immediately audible - which is the only way to tell that it
                 * worked. */
                if (!soundOn) setTimeout(() => play("ding"), 0);
                showBalloon(
                  soundOn ? "Sound is off" : "Sound is on",
                  soundOn
                    ? "Click the speaker again to turn it back on."
                    : "Sounds are synthesized, not sampled - there is no audio file in this build."
                );
              }}
            >
              {soundOn ? <VolumeIcon /> : <VolumeMuteIcon />}
            </button>
          </div>
          <Clock />
        </div>
      </div>
    </>
  );
}
