import { useState } from "react";
import { useWindowStore } from "../store/windowStore";
import { useShellStore } from "../store/shellStore";
import styles from "./TaskbarProperties.module.css";

type Props = { windowId?: string };
type Tab = "taskbar" | "start";

/* Taskbar and Start Menu Properties. Four of the boxes do something - Lock,
 * Auto-hide, Show Quick Launch, Show the clock - and the taskbar follows as
 * they are ticked, which is what the little picture above them was for.
 * The others are drawn, checked the way a fresh install had them, and
 * disabled: the shape of the dialog is most of what people remember. */

function Box({
  id,
  label,
  checked,
  onChange,
  disabled,
  type = "checkbox",
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
  type?: "checkbox" | "radio";
}) {
  return (
    <div className={styles.check}>
      <input id={id} type={type} name={type === "radio" ? "start" : undefined} checked={checked} disabled={disabled} readOnly={!onChange} onChange={(e) => onChange?.(e.target.checked)} />
      <label htmlFor={id}>{label}</label>
    </div>
  );
}

export function TaskbarProperties({ windowId }: Props) {
  const close = useWindowStore((s) => s.close);
  const shell = useShellStore();
  const [tab, setTab] = useState<Tab>("taskbar");
  const done = () => windowId && close(windowId);

  return (
    <div className={styles.app}>
      <div className={styles.tabs}>
        <button type="button" className={tab === "taskbar" ? `${styles.tab} ${styles.active}` : styles.tab} onClick={() => setTab("taskbar")}>
          Taskbar
        </button>
        <button type="button" className={tab === "start" ? `${styles.tab} ${styles.active}` : styles.tab} onClick={() => setTab("start")}>
          Start Menu
        </button>
      </div>

      <div className={styles.page}>
        {tab === "taskbar" && (
          <>
            <fieldset className={styles.group}>
              <legend>Taskbar appearance</legend>
              {/* The preview: a strip of taskbar that shows the boxes' effect. */}
              <div className={styles.preview}>
                <span className={styles.previewStart}>start</span>
                {shell.quickLaunch && <span className={styles.previewQuick} />}
                <span className={styles.previewTask} />
                <span className={styles.previewTray}>{shell.showClock ? "1:23 PM" : ""}</span>
              </div>
              <Box id="tb-lock" label="Lock the taskbar" checked={shell.locked} onChange={(v) => shell.set({ locked: v })} />
              <Box id="tb-hide" label="Auto-hide the taskbar" checked={shell.autoHide} onChange={(v) => shell.set({ autoHide: v })} />
              <Box id="tb-top" label="Keep the taskbar on top of other windows" checked disabled />
              <Box id="tb-group" label="Group similar taskbar buttons" checked={false} disabled />
              <Box id="tb-quick" label="Show Quick Launch" checked={shell.quickLaunch} onChange={(v) => shell.set({ quickLaunch: v })} />
            </fieldset>
            <fieldset className={styles.group}>
              <legend>Notification area</legend>
              <Box id="tb-clock" label="Show the clock" checked={shell.showClock} onChange={(v) => shell.set({ showClock: v })} />
              <Box id="tb-inactive" label="Hide inactive icons" checked={shell.hideInactive} onChange={(v) => shell.set({ hideInactive: v })} />
              <p className={styles.blurb}>
                You can keep the notification area uncluttered by hiding icons that you have not clicked
                recently. The arrow next to the clock shows them again.
              </p>
            </fieldset>
          </>
        )}

        {tab === "start" && (
          <>
            <p className={styles.blurb}>Select a menu style. The Start menu is the two-column one; the classic single-column menu is not here.</p>
            <Box id="sm-new" type="radio" label="Start menu — this menu style gives you easy access to your folders, favorite programs, and search" checked />
            <Box id="sm-classic" type="radio" label="Classic Start menu — the menu style from earlier versions of Windows" checked={false} disabled />
            <p className={styles.blurb}>
              The pinned programs at the top of the menu are Internet Explorer, Notepad and About funOS. My Recent
              Documents lists what you have opened.
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
