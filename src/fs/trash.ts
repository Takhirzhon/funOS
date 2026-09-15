import { useFsStore } from "../store/fsStore";
import { confirmDialog, errorDialog } from "../store/dialogStore";
import { basename, isInside } from "./path";
import { RECYCLE_BIN } from "./seed";
import { accessDenied, firstSystemPath } from "./system";

/* Deleting, in one place, because the desktop and Explorer must ask the same
 * question and mean the same thing by the answer.
 *
 * Windows has two deletes and so does this: Delete recycles, Shift+Delete is
 * permanent. Anything already in the Recycle Bin can only be deleted
 * permanently - there is nowhere further for it to go, and offering to recycle
 * it would be a no-op with a confirmation dialog in front of it.
 */
export async function deletePaths(paths: string[], permanent = false): Promise<string[]> {
  const fs = useFsStore.getState();
  const targets = paths.filter((p) => fs.exists(p));
  if (targets.length === 0) return [];

  /* Refused before the question, not after it. Windows names the first file
   * it cannot touch and stops there, which is what this does too. */
  const owned = firstSystemPath(targets);
  if (owned) {
    await accessDenied("delete", owned);
    return [];
  }

  /* One question for the whole selection, not one per file. Windows asks once
   * and names the count; asking five times is how a "delete these five" turns
   * into four cancels and an accident. */
  const forever = permanent || targets.every((p) => isInside(RECYCLE_BIN, p));
  const single = targets.length === 1 ? fs.get(targets[0]) : undefined;
  const name = single ? basename(single.restorePath ?? single.path) : "";
  const what = single
    ? single.kind === "dir"
      ? "folder and everything in it"
      : "file"
    : `${targets.length} items`;

  const ok = await confirmDialog(
    forever ? "Confirm Delete" : "Confirm File Delete",
    forever
      ? `Are you sure you want to permanently delete ${single ? `this ${what}` : what}?${single ? `\n\n${name}` : ""}\n\nThis cannot be undone.`
      : `Are you sure you want to send ${single ? `this ${what}` : what} to the Recycle Bin?${single ? `\n\n${name}` : ""}`
  );
  if (!ok) return [];

  const deleted: string[] = [];
  const failed: string[] = [];

  for (const path of targets) {
    /* Decided per item rather than for the batch: a selection can straddle the
     * bin, and something already in it has to go permanently whatever the rest
     * of the selection does. */
    const goneForever = permanent || isInside(RECYCLE_BIN, path);
    const success = goneForever ? fs.remove(path) : fs.recycle(path) !== null;
    if (success) deleted.push(path);
    else failed.push(basename(path));
  }

  if (failed.length > 0) {
    void errorDialog("Delete", `These could not be deleted: ${failed.join(", ")}`);
  }
  return deleted;
}

/** The single-item case, which is most of the call sites. */
export const deletePath = async (path: string, permanent = false): Promise<boolean> =>
  (await deletePaths([path], permanent)).length > 0;
