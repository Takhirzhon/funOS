import { useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
import { listEntries, useFsStore } from "../store/fsStore";
import { useMenuStore } from "../store/menuStore";
import { confirmDialog, errorDialog, propertiesDialog } from "../store/dialogStore";
import { playSound } from "../store/soundStore";
import { RECYCLE_BIN } from "../fs/seed";
import { basename, dirname, display } from "../fs/path";
import { entryIcon, entryType } from "../fs/icons";
import { MenuBar } from "../components/MenuBar";
import styles from "./RecycleBin.module.css";

export function RecycleBin() {
  const entries = useFsStore((s) => s.entries);
  const restore = useFsStore((s) => s.restore);
  const remove = useFsStore((s) => s.remove);
  const emptyBin = useFsStore((s) => s.emptyBin);
  const openMenu = useMenuStore((s) => s.open);
  const [selected, setSelected] = useState<string | null>(null);

  /* The one listing that asks for hidden entries: the bin's own contents are
   * hidden from Explorer, and this window exists to show them. */
  const items = useMemo(() => listEntries(entries, RECYCLE_BIN, true), [entries]);

  const restoreOne = (path: string) => {
    const result = restore(path);
    if (result === null) {
      void errorDialog(
        "Restore",
        `Cannot restore '${basename(path)}'.\n\nThe folder it came from no longer exists.`
      );
      return;
    }
    if (selected === path) setSelected(null);
  };

  const deleteOne = async (path: string) => {
    const ok = await confirmDialog(
      "Confirm Delete",
      `Are you sure you want to permanently delete '${basename(path)}'?\n\nThis cannot be undone.`
    );
    if (!ok) return;
    remove(path);
    if (selected === path) setSelected(null);
  };

  const empty = async () => {
    if (items.length === 0) return;
    const ok = await confirmDialog(
      "Confirm Multiple File Delete",
      `Are you sure you want to delete these ${items.length} item(s)?\n\nThis cannot be undone.`
    );
    if (ok) {
      emptyBin();
      playSound("recycle");
      setSelected(null);
    }
  };

  const itemMenu = (path: string) => (e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelected(path);
    openMenu(e.clientX, e.clientY, [
      { kind: "item", label: "Restore", bold: true, onClick: () => restoreOne(path) },
      { kind: "separator" },
      { kind: "item", label: "Delete", onClick: () => void deleteOne(path) },
      { kind: "separator" },
      {
        kind: "item",
        label: "Properties",
        onClick: () => void propertiesDialog([path], basename(path)),
      },
    ]);
  };

  return (
    <div className={styles.app}>
      <MenuBar
        menus={[
          {
            label: "File",
            items: [
              {
                label: "Restore",
                disabled: !selected,
                onClick: () => selected && restoreOne(selected),
              },
              { label: "Empty the Recycle Bin", disabled: items.length === 0, onClick: () => void empty() },
            ],
          },
        ]}
      />

      <div className={styles.main} onMouseDown={() => setSelected(null)}>
        {items.length === 0 ? (
          <div className={styles.empty}>The Recycle Bin is empty.</div>
        ) : (
          <>
            <div className={styles.headerRow}>
              <span>Name</span>
              <span>Original Location</span>
              <span>Type</span>
            </div>
            {items.map((entry) => (
              <button
                key={entry.path}
                type="button"
                className={
                  selected === entry.path ? `${styles.row} ${styles.selected}` : styles.row
                }
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setSelected(entry.path);
                }}
                onDoubleClick={() => restoreOne(entry.path)}
                onContextMenu={itemMenu(entry.path)}
              >
                <span className={styles.name}>
                  {entryIcon(entry, 16)}
                  <span className={styles.ellipsis}>
                    {/* The name it had before it was deleted. The path inside the
                        bin may carry a "(2)" that the original never had. */}
                    {entry.restorePath ? basename(entry.restorePath) : basename(entry.path)}
                  </span>
                </span>
                <span className={styles.ellipsis}>
                  {entry.restorePath ? display(dirname(entry.restorePath)) : "Unknown"}
                </span>
                <span className={styles.ellipsis}>{entryType(entry)}</span>
              </button>
            ))}
          </>
        )}
      </div>

      <div className={styles.status}>
        <span>
          {items.length} object{items.length === 1 ? "" : "s"}
        </span>
        <span>Double-click an item to put it back.</span>
      </div>
    </div>
  );
}
