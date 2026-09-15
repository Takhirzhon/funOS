import { isBinary, type FsEntry } from "../store/fsStore";
import { useWindowStore } from "../store/windowStore";
import { useRecentStore } from "../store/recentStore";
import { errorDialog } from "../store/dialogStore";
import { basename } from "./path";
import { isPostEntry, postUrl } from "../blog/posts";

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
  useRecentStore.getState().touch(entry.path);

  if (isBinary(entry)) {
    const mime = entry.mime ?? "";
    if (mime.startsWith("image/")) {
      open("imageViewer", {
        title: `${name} - Windows Picture Viewer`,
        bounds: { width: 620, height: 480 },
        props: { path: entry.path },
      });
      return;
    }
    if (mime.startsWith("video/") || mime.startsWith("audio/")) {
      open("mediaPlayer", {
        title: `${name} - Windows Media Player`,
        bounds: { width: 640, height: 520 },
        props: { path: entry.path },
      });
      return;
    }
    if (mime === "application/pdf") {
      open("pdfReader", {
        title: `${name} - PDF Reader`,
        bounds: { width: 720, height: 560 },
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

  /* A blog post is read in the browser, where it is a page; Notepad would
   * show the Markdown. Explorer's double-click and the Recent list both
   * come through here, so both get the page. */
  if (isPostEntry(entry)) {
    open("internetExplorer", {
      title: "Internet Explorer",
      bounds: { width: 780, height: 580 },
      props: { url: postUrl(entry) },
    });
    return;
  }

  open("notepad", {
    title: `${name} - Notepad`,
    bounds: { width: 560, height: 420 },
    props: { path: entry.path },
  });
}
