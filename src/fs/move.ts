import { useFsStore } from "../store/fsStore";
import { errorDialog } from "../store/dialogStore";
import { basename } from "./path";
import { RECYCLE_BIN } from "./seed";
import { accessDenied, firstSystemPath } from "./system";

/* Moving things into a folder, in one place, because the desktop's pointer
 * drag and Explorer's HTML5 drag must mean the same thing by a drop - and
 * because a drop is a list now, and five files failing should be one dialog,
 * not five.
 *
 * The Recycle Bin is a destination like any other to the person dragging,
 * and a different operation underneath: recycled, so Restore knows the way
 * back. A system file anywhere in the list stops the whole drop before it
 * starts, the way Windows refused the batch on the first file it could not
 * touch.
 */
export function moveInto(paths: string[], folder: string): void {
  const targets = [...new Set(paths)];
  if (targets.length === 0) return;

  const owned = firstSystemPath(targets);
  if (owned) {
    void accessDenied(folder === RECYCLE_BIN ? "delete" : "move", owned);
    return;
  }

  const fs = useFsStore.getState();
  const failed: string[] = [];
  for (const path of targets) {
    const result = folder === RECYCLE_BIN ? fs.recycle(path) : fs.move(path, folder);
    if (result === null) failed.push(basename(path));
  }

  if (failed.length === 0) return;
  if (folder === RECYCLE_BIN) {
    void errorDialog("Recycle Bin", `Cannot send to the Recycle Bin: ${failed.join(", ")}`);
    return;
  }
  void errorDialog(
    "Move",
    failed.length === 1
      ? `Cannot move '${failed[0]}' here: something with that name already exists, or that folder is inside the one being moved.`
      : `${failed.length} of ${targets.length} items could not be moved here: ${failed.join(", ")}.\n\nSomething with the same name already exists, or the folder is inside one of them.`
  );
}
