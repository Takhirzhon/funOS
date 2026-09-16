import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useWindowStore } from "../store/windowStore";
import { useMenuStore } from "../store/menuStore";
import { useSoundStore } from "../store/soundStore";
import { showBalloon } from "../store/balloonStore";
import { windowSystemMenu } from "./windowSystemMenu";
import { apps, type AppId } from "../apps/registry";
import { StartButton } from "./StartButton";
import { StartMenu } from "./StartMenu";
import { Clock } from "./Clock";
import { useShellStore } from "../store/shellStore";
import {
  IEIcon,
  NetworkIcon,
  ShieldIcon,
  ShowDesktopIcon,
  VolumeIcon,
  VolumeMuteIcon,
} from "../icons";
import styles from "./Taskbar.module.css";

const TRAY_TIP_KEY = "funos.tray.tip";

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
  const locked = useShellStore((s) => s.locked);
  const autoHide = useShellStore((s) => s.autoHide);
  const quickLaunch = useShellStore((s) => s.quickLaunch);
  const showClock = useShellStore((s) => s.showClock);
  const hideInactive = useShellStore((s) => s.hideInactive);
  /* The chevron. Security Center and the network are the inactive ones -
   * nobody clicks them - and the speaker stays out. Showing them again is a
   * click on the arrow; they tuck back in a few seconds after the pointer
   * has left the tray, or at the next press anywhere. */
  const [trayOpen, setTrayOpen] = useState(false);
  const trayTimer = useRef<number | undefined>(undefined);
  const trayLeave = () => {
    window.clearTimeout(trayTimer.current);
    trayTimer.current = window.setTimeout(() => setTrayOpen(false), 4000);
  };
  const trayEnter = () => window.clearTimeout(trayTimer.current);
  useEffect(() => {
    if (!trayOpen) return;
    const close = () => setTrayOpen(false);
    window.addEventListener("mousedown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.clearTimeout(trayTimer.current);
    };
  }, [trayOpen]);
  /* The balloon XP put up the first time it hid something, once and never
   * again - which is what made it feel like the machine noticing you. A
   * minute in, so it is not the first thing on a fresh desktop. */
  useEffect(() => {
    if (!hideInactive) return;
    let seen = false;
    try {
      seen = localStorage.getItem(TRAY_TIP_KEY) === "1";
    } catch {
      /* Private mode: it will show again, which is fine. */
    }
    if (seen) return;
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(TRAY_TIP_KEY, "1");
      } catch {
        /* Private mode. */
      }
      showBalloon("Windows hides inactive icons", "Click the arrow next to the clock to show the icons that you have not used in a while.");
    }, 60_000);
    return () => window.clearTimeout(t);
  }, [hideInactive]);
  /* Auto-hide: the bar slides down to a two-pixel line and comes back when
   * the pointer reaches the bottom of the screen, or while the Start menu
   * is open. A short delay before hiding, so crossing the edge to reach a
   * task button does not snatch it away. */
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    if (!autoHide) return;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    const onMove = (e: PointerEvent) => {
      const nearEdge = e.clientY >= document.documentElement.clientHeight - 3;
      const overBar = e.clientY >= document.documentElement.clientHeight - 30;
      if (nearEdge) {
        clearTimeout(hideTimer);
        setRevealed(true);
      } else if (!overBar) {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => setRevealed(false), 400);
      }
    };
    window.addEventListener("pointermove", onMove);
    return () => {
      clearTimeout(hideTimer);
      window.removeEventListener("pointermove", onMove);
    };
  }, [autoHide]);

  /* The taskbar's own menu. Everything here acts on every window at once,
   * which is exactly what distinguishes it from the task button's menu. */
  /* Stable, so the key listener below is registered once. */
  const launch = useCallback(
    (appId: AppId) => open(appId, { title: apps[appId].title, bounds: apps[appId].defaultSize }),
    [open]
  );

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
      { kind: "item", label: "Task Manager", onClick: () => launch("taskManager") },
      { kind: "item", label: "Properties", onClick: () => launch("taskbarProperties") },
    ]);
  };

  useEffect(() => {
    if (!startOpen) return;
    const close = () => setStartOpen(false);
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [startOpen]);

  /* The shell's own keys.
   *
   *   Pause            System Properties. Win+Pause on the real thing; the Win
   *                    half never reaches a page, and Pause has no other use.
   *   Ctrl+Shift+Esc   Task Manager. Windows takes this one for its own Task
   *                    Manager, so it works on every other host; the taskbar
   *                    menu and `taskmgr` in Run are the ones that always do.
   *   Ctrl+Esc         The Start menu, and it arrives everywhere.
   *   Win, alone       The Start menu too - on hosts that let the key through.
   *                    "Alone" is a press and release with nothing in between,
   *                    so Win+R on a host that does let it through does not
   *                    also open the menu.
   */
  useEffect(() => {
    let metaAlone = false;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Meta") {
        metaAlone = true;
        return;
      }
      metaAlone = false;
      if (e.key === "Pause") {
        e.preventDefault();
        launch("systemProperties");
      } else if (e.key === "Escape" && e.ctrlKey && e.shiftKey) {
        e.preventDefault();
        launch("taskManager");
      } else if (e.key === "Escape" && e.ctrlKey) {
        e.preventDefault();
        setStartOpen((v) => !v);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Meta" && metaAlone) setStartOpen((v) => !v);
      metaAlone = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [launch]);

  return (
    <>
      {startOpen && <StartMenu onClose={() => setStartOpen(false)} />}
      <div
        className={[styles.bar, autoHide && !revealed && !startOpen ? styles.hidden : ""].join(" ")}
        onMouseDown={(e) => e.stopPropagation()}
        onContextMenu={barMenu}
      >
        <StartButton open={startOpen} onClick={() => setStartOpen((v) => !v)} />

        {/* Quick Launch. XP shipped with it enabled and with exactly these two
         * entries, which is the only reason Show Desktop is here rather than in
         * the tray: it is a Quick Launch shortcut, not a notification.
         */}
        {quickLaunch && (
          <>
        {!locked && <div className={styles.grip} aria-hidden />}
        <div className={styles.quickLaunch}>
          <button
            type="button"
            className={styles.quickButton}
            data-tip="Show Desktop"
            onClick={minimizeAll}
          >
            <ShowDesktopIcon />
          </button>
          <button
            type="button"
            className={styles.quickButton}
            data-tip="Launch Internet Explorer Browser"
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
          </>
        )}
        {!locked && <div className={styles.grip} aria-hidden />}

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
                data-tip={w.title}
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

        <div className={styles.tray} onMouseEnter={trayEnter} onMouseLeave={trayLeave}>
          {hideInactive && (
            <button
              type="button"
              className={trayOpen ? `${styles.chevron} ${styles.chevronOpen}` : styles.chevron}
              data-tip={trayOpen ? "Hide" : "Show hidden icons"}
              aria-label={trayOpen ? "Hide inactive icons" : "Show hidden icons"}
              aria-expanded={trayOpen}
              onClick={() => setTrayOpen((v) => !v)}
            >
              <span className={styles.chevronGlyph} aria-hidden />
            </button>
          )}
          <div className={styles.trayIcons}>
            {(!hideInactive || trayOpen) && (
              <>
                <span className={styles.trayIcon} data-tip="Your computer might be at risk">
                  <ShieldIcon />
                </span>
                <span className={styles.trayIcon} data-tip="Local Area Connection - Speed: 100.0 Mbps, Status: Connected">
                  <NetworkIcon />
                </span>
              </>
            )}
            <button
              type="button"
              className={styles.trayIcon}
              data-tip={soundOn ? "Volume" : "Volume (muted)"}
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
          {showClock && <Clock />}
        </div>
      </div>
    </>
  );
}
