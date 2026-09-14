import { useFsStore } from "../store/fsStore";
import { confirmDialog, errorDialog } from "../store/dialogStore";
import { basename } from "./path";
import { RECYCLE_BIN } from "./seed";
import { isInside } from "./path";

/* Deleting, in one place, because the desktop and Explorer must ask the same
 * question and mean the same thing by the answer.
 *
 * Windows has two deletes and so does this: Delete recycles, Shift+Delete is
 * permanent. Anything already in the Recycle Bin can only be deleted
 * permanently - there is nowhere further for it to go, and offering to recycle
 * it would be a no-op with a confirmation dialog in front of it.
 */
export async function deletePath(path: string, permanent = false): Promise<boolean> {
  const fs = useFsStore.getState();
  const entry = fs.get(path);
  if (!entry) return false;

  const inBin = isInside(RECYCLE_BIN, path);
  const forever = permanent || inBin;
  const name = basename(entry.restorePath ?? path);
  const what = entry.kind === "dir" ? "folder and everything in it" : "file";

  const ok = await confirmDialog(
    forever ? "Confirm Delete" : "Confirm File Delete",
    forever
      ? `Are you sure you want to permanently delete this ${what}?\n\n${name}\n\nThis cannot be undone.`
      : `Are you sure you want to send this ${what} to the Recycle Bin?\n\n${name}`
  );
  if (!ok) return false;

  if (forever) return fs.remove(path);

  if (fs.recycle(path) === null) {
    void errorDialog("Delete", `'${name}' could not be moved to the Recycle Bin.`);
    return false;
  }
  return true;
}
