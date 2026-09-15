import { useMemo, useState } from "react";
import { useFsStore } from "../store/fsStore";
import { useWindowStore } from "../store/windowStore";
import { errorDialog } from "../store/dialogStore";
import { DRIVE } from "../fs/path";
import { entryBytes } from "../fs/icons";
import { CdDriveIcon, DriveIcon, RemovableDriveIcon } from "../icons";
import styles from "./MyComputer.module.css";

/* Only C: has a file system behind it. The other two are here because My
 * Computer with one drive in it looks like a mistake, and because a CD drive
 * that says "insert a disc" is more honest than pretending it is not there.
 */
const drives = [
  { letter: DRIVE, label: "Local Disk", kind: "Local Disk", mounted: true, icon: DriveIcon },
  { letter: "D:", label: "CD Drive", kind: "CD Drive", mounted: false, icon: CdDriveIcon },
  { letter: "E:", label: "Removable Disk", kind: "Removable Disk", mounted: false, icon: RemovableDriveIcon },
];

export function MyComputer() {
  const entries = useFsStore((s) => s.entries);
  const open = useWindowStore((s) => s.open);
  const [selected, setSelected] = useState<string | null>(null);

  /* Size on disk, from the only thing here that is real: how much the file
   * system is actually holding, text and bytes both. It goes up when you save
   * something, which costs nothing and is better than a hardcoded 40.0 GB.
   */
  const used = useMemo(
    () => Object.values(entries).reduce((total, e) => total + entryBytes(e), 0),
    [entries]
  );

  const openDrive = (letter: string, mounted: boolean) => {
    if (!mounted) {
      void errorDialog(
        `${letter}\\ is not accessible`,
        "The device is not ready.\n\nInsert a disc and try again."
      );
      return;
    }
    open("explorer", {
      title: `Local Disk (${letter})`,
      bounds: { width: 660, height: 460 },
      props: { path: letter },
    });
  };

  return (
    <div className={styles.app} onMouseDown={() => setSelected(null)}>
      <h3 className={styles.heading}>Hard Disk Drives</h3>
      <div className={styles.grid}>
        {drives.map((drive) => (
          <button
            key={drive.letter}
            type="button"
            className={
              selected === drive.letter ? `${styles.drive} ${styles.selected}` : styles.drive
            }
            onMouseDown={(e) => {
              e.stopPropagation();
              setSelected(drive.letter);
            }}
            onDoubleClick={() => openDrive(drive.letter, drive.mounted)}
          >
            <drive.icon size={48} />
            <span className={styles.label}>{`${drive.label} (${drive.letter})`}</span>
            <span className={styles.detail}>
              {drive.mounted ? `${(used / 1024).toFixed(1)} KB used` : drive.kind}
            </span>
          </button>
        ))}
      </div>

      <p className={styles.hint}>
        Double-click Local Disk (C:) to browse the file system. It lives in IndexedDB, so
        anything you save is still here tomorrow.
      </p>
    </div>
  );
}
