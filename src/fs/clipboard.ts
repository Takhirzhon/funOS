import { useClipboardStore } from "../store/clipboardStore";
import { useFsStore } from "../store/fsStore";
import { errorDialog } from "../store/dialogStore";
import { basename, display } from "./path";

/* Paste, in one place, because the desktop and Explorer must not disagree about
 * what it does - and there are two things here that are easy to get subtly
 * different if written twice.
 */
export function pasteInto(folder: string): void {
  const { path, mode, clear } = useClipboardStore.getState();
  if (!path) return;

  const fs = useFsStore.getState();
  if (!fs.exists(path)) {
    void errorDialog(
      "Paste",
      `${display(path)}\n\nThe item was moved or deleted after it was copied.`
    );
    clear();
    return;
  }

  const result = mode === "cut" ? fs.move(path, folder) : fs.copy(path, folder);

  if (result === null) {
    void errorDialog(
      "Paste",
      mode === "cut"
        ? `Cannot move '${basename(path)}' here: something with that name already exists, or the destination is inside the folder being moved.`
        : `Cannot copy '${basename(path)}' here.`
    );
    return;
  }

  /* A cut can be pasted once; a copy as many times as you like. Leaving a cut
   * on the clipboard would make the second paste fail - the source no longer
   * exists at the path the clipboard remembers.
   */
  if (mode === "cut") clear();
}
