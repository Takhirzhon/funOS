import { isBinary, type FsEntry } from "../store/fsStore";
import { useWindowStore } from "../store/windowStore";
import { errorDialog } from "../store/dialogStore";
import { basename } from "./path";

/* Which application opens a file.
 *
 * One function, because the desktop and Explorer both need it and "everything
 * opens in Notepad" stopped being true the moment the file system could hold
 * bytes. Opening a PNG in a text editor does not fail - it fills the window
 * with mojibake, which is worse, because it looks like the file is corrupt
 * rather than like the wrong program opened it.
 *
 * Directories are deliberately not handled here: Explorer navigates to them
 * inside the window it is already in, and the desktop opens a new one. That is
 * a difference in the caller, not in the file.
 */
export function launchFile(entry: FsEntry): void {
  const open = useWindowStore.getState().open;
  const name = basename(entry.path);

  if (isBinary(entry)) {
    if (entry.mime?.startsWith("image/")) {
      open("imageViewer", {
        title: `${name} - Windows Picture Viewer`,
        bounds: { width: 620, height: 480 },
        props: { path: entry.path },
      });
      return;
    }
    void errorDialog(
      "funOS",
      `Windows cannot open this file:\n\n${name}\n\nIt is not a text file and there is no program here that reads ${entry.mime || "this type"}.`
    );
    return;
  }

  open("notepad", {
    title: `${name} - Notepad`,
    bounds: { width: 560, height: 420 },
    props: { path: entry.path },
  });
}
