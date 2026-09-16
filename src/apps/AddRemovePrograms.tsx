import { useState } from "react";
import { useWindowStore } from "../store/windowStore";
import { errorDialog } from "../store/dialogStore";
import { apps, appIds, type AppId } from "./registry";
import { AddRemoveProgramsIcon } from "../icons";
import styles from "./AddRemovePrograms.module.css";

/* Add or Remove Programs: the list every XP machine had, with a size column
 * that was never right. The programs are the registry; the sizes are what
 * each one costs to download, which is at least a true number. Remove is
 * refused the way Windows refused it for its own parts, and Change opens
 * the program - which is the only change there is. */

/* Rough gzipped chunk sizes, so the column says something. Kept in the
 * spirit of the original: approximately right and rarely updated. */
const SIZES: Partial<Record<AppId, string>> = {
  paint: "2.4 KB",
  solitaire: "2.1 KB",
  explorer: "3.7 KB",
  internetExplorer: "7.0 KB",
  mediaPlayer: "2.1 KB",
  taskManager: "4.2 KB",
  commandPrompt: "2.0 KB",
  minesweeper: "1.6 KB",
  calculator: "1.6 KB",
};

export function AddRemovePrograms() {
  const open = useWindowStore((s) => s.open);
  const [selected, setSelected] = useState<AppId | null>(null);

  const programs = [...appIds]
    .filter((id) => id !== "addRemovePrograms")
    .sort((a, b) => apps[a].label.localeCompare(apps[b].label));

  const remove = (id: AppId) =>
    void errorDialog(
      "Add or Remove Programs",
      `Windows cannot remove ${apps[id].label}.\n\nIt is part of funOS, and every part of funOS is needed for the desktop to look like this. There is nothing to uninstall: the program is downloaded when it is opened and forgotten when the tab closes.`
    );

  return (
    <div className={styles.app}>
      <div className={styles.side}>
        <button type="button" className={`${styles.sideButton} ${styles.sideCurrent}`}>
          <AddRemoveProgramsIcon size={32} />
          Change or Remove Programs
        </button>
        <button type="button" className={styles.sideButton} onClick={() => void errorDialog("Add New Programs", "Programs arrive with a deploy. There is no CD-ROM drive, and the D: in My Computer says so.")}>
          Add New Programs
        </button>
        <button type="button" className={styles.sideButton} onClick={() => void errorDialog("Add/Remove Windows Components", "Every component is installed. It is a small Windows.")}>
          Add/Remove Windows Components
        </button>
      </div>
      <div className={styles.main}>
        <div className={styles.head}>Currently installed programs:</div>
        <div className={styles.list} onMouseDown={() => setSelected(null)}>
          {programs.map((id) => {
            const Icon = apps[id].icon;
            const current = selected === id;
            return (
              <div
                key={id}
                className={current ? `${styles.row} ${styles.current}` : styles.row}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setSelected(id);
                }}
              >
                <div className={styles.rowHead}>
                  <Icon size={20} />
                  <span className={styles.name}>{apps[id].label}</span>
                  <span className={styles.size}>
                    {SIZES[id] ? (
                      <>
                        <span className={styles.dim}>Size</span> {SIZES[id]}
                      </>
                    ) : null}
                  </span>
                </div>
                {current && (
                  <div className={styles.rowBody}>
                    <span className={styles.dim}>Used</span> whenever you open it
                    <div className={styles.rowButtons}>
                      <button type="button" onClick={() => open(id, { title: apps[id].title, bounds: apps[id].defaultSize })}>
                        Change
                      </button>
                      <button type="button" onClick={() => remove(id)}>
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
