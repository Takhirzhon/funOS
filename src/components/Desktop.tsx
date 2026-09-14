import { useState } from "react";
import { useWindowStore } from "../store/windowStore";
import { apps, appIds, type AppId } from "../apps/registry";
import { DesktopIcon } from "./DesktopIcon";
import styles from "./Desktop.module.css";

const desktopApps = appIds.filter((id) => apps[id].onDesktop);

export function Desktop() {
  const open = useWindowStore((s) => s.open);
  const [selected, setSelected] = useState<AppId | null>(null);

  return (
    <div className="desktop" onMouseDown={() => setSelected(null)}>
      <div className={styles.field}>
        {desktopApps.map((id) => {
          const app = apps[id];
          const Icon = app.icon;
          return (
            <DesktopIcon
              key={id}
              label={app.label}
              icon={<Icon size={32} />}
              selected={selected === id}
              onSelect={() => setSelected(id)}
              onOpen={() =>
                open(id, { title: app.title, bounds: app.defaultSize })
              }
            />
          );
        })}
      </div>
    </div>
  );
}
