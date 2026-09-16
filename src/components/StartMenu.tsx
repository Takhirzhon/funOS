import { useEffect, useRef, useState, type ReactNode } from "react";
import { useWindowStore } from "../store/windowStore";
import { useSessionStore } from "../store/sessionStore";
import { apps, appIds, type AppId } from "../apps/registry";
import { run } from "../fs/run";
import { useRecentStore } from "../store/recentStore";
import { useFsStore } from "../store/fsStore";
import { launchFile } from "../fs/open";
import { entryIcon } from "../fs/icons";
import { basename } from "../fs/path";
import { RecentDocumentsIcon } from "../icons";
import {
  ControlPanelIcon,
  DocumentsIcon,
  HelpIcon,
  LogOffIcon,
  RunIcon,
  SearchIcon,
  ShutdownIcon,
} from "../icons";
import styles from "./StartMenu.module.css";

type Props = { onClose: () => void };

/* Pinned programs — the bold entries at the top of the white column. XP's
 * first two were always "Internet" and "E-mail", with the program's name
 * underneath; the label is the role, the sub is what fills it. */
const pinned: { appId: AppId; label?: string; sub: string }[] = [
  { appId: "internetExplorer", label: "Internet", sub: "Internet Explorer" },
  { appId: "notepad", sub: "Plain-text editor" },
  { appId: "about", sub: "Project info" },
];

/* Places — the right column. Entries with no app behind them are rendered
 * disabled rather than omitted: the shape of the menu is part of what makes it
 * recognisable, and a greyed row is an honest "not built yet" where a missing
 * row is a silent one.
 */
const places: { appId?: AppId; label: string; icon: ReactNode }[] = [
  { label: "My Documents", icon: <DocumentsIcon size={22} /> },
  { appId: "myComputer", label: "My Computer", icon: <AppGlyph id="myComputer" /> },
  { appId: "recycleBin", label: "Recycle Bin", icon: <AppGlyph id="recycleBin" /> },
];

const tools: { label: string; icon: ReactNode; appId?: AppId; action?: () => void }[] = [
  { label: "Control Panel", icon: <ControlPanelIcon size={22} />, appId: "controlPanel" },
  { label: "Help and Support", icon: <HelpIcon size={22} />, appId: "helpAndSupport" },
  { label: "Search", icon: <SearchIcon size={22} />, appId: "search" },
  { label: "Run...", icon: <RunIcon size={22} />, action: () => void run() },
];

function AppGlyph({ id, size = 22 }: { id: AppId; size?: number }) {
  const Icon = apps[id].icon;
  return <Icon size={size} />;
}

/* Everything in the registry, alphabetically. Sorted by the label people see
 * rather than by the id, so "My Computer" files under M and not under "my". */
const allPrograms = [...appIds].sort((a, b) => apps[a].label.localeCompare(apps[b].label));

export function StartMenu({ onClose }: Props) {
  const open = useWindowStore((s) => s.open);
  const logOff = useSessionStore((s) => s.logOff);
  const askTurnOff = useSessionStore((s) => s.askTurnOff);
  const [allOpen, setAllOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const recentPaths = useRecentStore((s) => s.paths);
  const entries = useFsStore((s) => s.entries);
  /* Only what still exists. The list is not told about deletions. */
  const recent = recentPaths.map((p) => entries[p]).filter((e) => e !== undefined);

  const hoverTimer = useRef<number | undefined>(undefined);
  const showAll = (on: boolean) => {
    window.clearTimeout(hoverTimer.current);
    setAllOpen(on);
  };
  const hover = (on: boolean) => {
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setAllOpen(on), on ? 250 : 400);
  };
  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  const launch = (appId: AppId) => {
    const app = apps[appId];
    open(appId, { title: app.title, bounds: app.defaultSize });
    onClose();
  };

  return (
    <div
      className={styles.menu}
      onMouseDown={(e) => {
        e.stopPropagation();
        /* A press on anything but All Programs and its list shuts the list. */
        if (allOpen && !(e.target as HTMLElement).closest(`.${styles.allPrograms}`)) showAll(false);
      }}
    >
      <div className={styles.header}>
        <div className={styles.avatar}>U</div>
        <div className={styles.userName}>User</div>
      </div>

      <div className={styles.body}>
        <div className={styles.left}>
          {pinned.map(({ appId, label, sub }) => (
            <MenuItem
              key={appId}
              icon={<AppGlyph id={appId} size={28} />}
              label={label ?? apps[appId].label}
              sub={sub}
              onClick={() => launch(appId)}
            />
          ))}

          <div className={styles.sep} />

          <div
            className={styles.allPrograms}
            /* The flyout follows the pointer the way XP's did: it opens a
             * moment after the pointer arrives, stays while the pointer is
             * on the button or the list, and goes a moment after it leaves
             * for another item. The delays are what let the pointer cross
             * the corner between the button and the list without the list
             * vanishing under it. */
            onMouseEnter={() => hover(true)}
            onMouseLeave={() => hover(false)}
          >
            <button
              type="button"
              className={
                allOpen
                  ? `${styles.allProgramsButton} ${styles.allProgramsOpen}`
                  : styles.allProgramsButton
              }
              /* Opens, never toggles. A tap on a touch screen arrives as a
               * synthetic mouseenter and then a click; a toggle here opened the
               * flyout and shut it again in the same gesture. A press anywhere
               * else in the menu is what closes it. */
              onClick={() => showAll(true)}
            >
              All Programs
              <span className={styles.chevron}>▶</span>
            </button>

            {allOpen && (
              <div className={styles.flyout}>
                <div className={styles.flyoutHeading}>Accessories</div>
                {allPrograms.map((appId) => (
                  <MenuItem
                    key={appId}
                    icon={<AppGlyph id={appId} size={20} />}
                    label={apps[appId].label}
                    onClick={() => launch(appId)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={styles.right}>
          {places.map((p) => (
            <MenuItem
              key={p.label}
              icon={p.icon}
              label={p.label}
              disabled={!p.appId}
              onClick={() => p.appId && launch(p.appId)}
            />
          ))}

          {/* My Recent Documents, with its list to the right - the one
              submenu XP had in this column. Opens on hover like All
              Programs, and only ever opens on click for the same reason. */}
          <div
            className={styles.recentWrap}
            onMouseEnter={() => setRecentOpen(true)}
            onMouseLeave={() => setRecentOpen(false)}
          >
            <MenuItem
              icon={<RecentDocumentsIcon size={22} />}
              label="My Recent Documents"
              chevron
              disabled={recent.length === 0}
              onClick={() => setRecentOpen(true)}
            />
            {recentOpen && recent.length > 0 && (
              <div className={`${styles.flyout} ${styles.flyoutRight}`}>
                {recent.map((entry) => (
                  <MenuItem
                    key={entry.path}
                    icon={entryIcon(entry, 20)}
                    label={basename(entry.path)}
                    onClick={() => {
                      onClose();
                      launchFile(entry);
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          <div className={styles.sep} />

          {tools.map((t) => (
            <MenuItem
              key={t.label}
              icon={t.icon}
              label={t.label}
              disabled={!t.appId && !t.action}
              onClick={() => {
                if (t.appId) launch(t.appId);
                else if (t.action) {
                  onClose();
                  t.action();
                }
              }}
            />
          ))}
        </div>
      </div>

      <div className={styles.footer}>
        <button
          type="button"
          className={styles.footerButton}
          onClick={() => {
            onClose();
            logOff();
          }}
        >
          <LogOffIcon size={20} />
          Log Off
        </button>
        <button
          type="button"
          className={styles.footerButton}
          onClick={() => {
            /* Close the menu first: the dialog dims the desktop, and leaving
               the Start menu open underneath it looks like two things are
               happening at once. */
            onClose();
            askTurnOff();
          }}
        >
          <ShutdownIcon size={20} />
          Turn Off Computer
        </button>
      </div>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  sub,
  onClick,
  disabled,
  chevron,
}: {
  icon: ReactNode;
  label: string;
  sub?: string;
  onClick: () => void;
  disabled?: boolean;
  /** Has a submenu: the small arrow at the right edge. */
  chevron?: boolean;
}) {
  return (
    <button type="button" className={styles.item} onClick={onClick} disabled={disabled}>
      <span className={styles.glyph}>{icon}</span>
      <span className={styles.itemText}>
        <span className={styles.itemLabel}>{label}</span>
        {sub && <span className={styles.itemSub}>{sub}</span>}
      </span>
      {chevron && <span className={styles.itemChevron}>▶</span>}
    </button>
  );
}
