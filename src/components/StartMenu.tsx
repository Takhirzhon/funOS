import type { ReactNode } from "react";
import { useWindowStore } from "../store/windowStore";
import { apps, type AppId } from "../apps/registry";
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

/* Pinned programs — the bold entries at the top of the white column. */
const pinned: { appId: AppId; sub: string }[] = [
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

const tools: { label: string; icon: ReactNode }[] = [
  { label: "Control Panel", icon: <ControlPanelIcon size={22} /> },
  { label: "Help and Support", icon: <HelpIcon size={22} /> },
  { label: "Search", icon: <SearchIcon size={22} /> },
  { label: "Run...", icon: <RunIcon size={22} /> },
];

function AppGlyph({ id, size = 22 }: { id: AppId; size?: number }) {
  const Icon = apps[id].icon;
  return <Icon size={size} />;
}

export function StartMenu({ onClose }: Props) {
  const open = useWindowStore((s) => s.open);

  const launch = (appId: AppId) => {
    const app = apps[appId];
    open(appId, { title: app.title, bounds: app.defaultSize });
    onClose();
  };

  return (
    <div className={styles.menu} onMouseDown={(e) => e.stopPropagation()}>
      <div className={styles.header}>
        <div className={styles.avatar}>U</div>
        <div className={styles.userName}>User</div>
      </div>

      <div className={styles.body}>
        <div className={styles.left}>
          {pinned.map(({ appId, sub }) => (
            <MenuItem
              key={appId}
              icon={<AppGlyph id={appId} size={28} />}
              label={apps[appId].label}
              sub={sub}
              onClick={() => launch(appId)}
            />
          ))}

          <div className={styles.sep} />

          <div className={styles.allPrograms}>
            <button type="button" className={styles.allProgramsButton} disabled>
              All Programs
              <span className={styles.chevron}>▶</span>
            </button>
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

          <div className={styles.sep} />

          {tools.map((t) => (
            <MenuItem key={t.label} icon={t.icon} label={t.label} disabled onClick={() => {}} />
          ))}
        </div>
      </div>

      <div className={styles.footer}>
        <button type="button" className={styles.footerButton} onClick={onClose}>
          <LogOffIcon size={20} />
          Log Off
        </button>
        <button type="button" className={styles.footerButton} onClick={onClose}>
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
}: {
  icon: ReactNode;
  label: string;
  sub?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" className={styles.item} onClick={onClick} disabled={disabled}>
      <span className={styles.glyph}>{icon}</span>
      <span className={styles.itemText}>
        <span className={styles.itemLabel}>{label}</span>
        {sub && <span className={styles.itemSub}>{sub}</span>}
      </span>
    </button>
  );
}
