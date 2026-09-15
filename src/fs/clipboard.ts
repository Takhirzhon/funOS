import { useClipboardStore } from "../store/clipboardStore";
import { useFsStore } from "../store/fsStore";
import { errorDialog } from "../store/dialogStore";
import { basename } from "./path";
import { accessDenied, firstSystemPath } from "./system";

/* Paste, in one place, because the desktop and Explorer must not disagree about
 * what it does.
 */
export function pasteInto(folder: string): void {
  const { paths, mode, clear } = useClipboardStore.getState();
  if (paths.length === 0) return;

  const fs = useFsStore.getState();

  /* A cut of a system file is allowed to sit on the clipboard - Windows lets
   * you press Ctrl+X on anything - and is refused here, where the move would
   * happen. A copy is fine: the copy is the visitor's. */
  const owned = mode === "cut" ? firstSystemPath(paths) : undefined;
  if (owned) {
    void accessDenied("move", owned);
    return;
  }

  const failed: string[] = [];
  let pasted = 0;

  for (const path of paths) {
    /* Something may have been deleted, or already moved, between the copy and
     * the paste. One missing item does not abandon the rest. */
    if (!fs.exists(path)) {
      failed.push(basename(path));
      continue;
    }
    const result = mode === "cut" ? fs.move(path, folder) : fs.copy(path, folder);
    if (result === null) failed.push(basename(path));
    else pasted += 1;
  }

  if (failed.length > 0) {
    void errorDialog(
      "Paste",
      failed.length === paths.length
        ? `Nothing could be pasted here.\n\n${failed.join(", ")}`
        : `${pasted} of ${paths.length} items were pasted.\n\nThese could not be: ${failed.join(", ")}`
    );
  }

  /* A cut can be pasted once; a copy as many times as you like. Leaving a cut
   * on the clipboard would make the second paste fail - the sources no longer
   * exist at the paths the clipboard remembers.
   *
   * Cleared even on a partial failure: whatever did move has moved, so the
   * remembered paths are stale either way.
   */
  if (mode === "cut" && pasted > 0) clear();
}
