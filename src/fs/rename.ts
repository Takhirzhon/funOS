import { useFsStore } from "../store/fsStore";
import { errorDialog } from "../store/dialogStore";
import { accessDenied, containsSystemPath } from "./system";
import { basename } from "./path";

/* Renaming in place: the edit box over the name, on the desktop and in
 * Explorer. The two surfaces draw the box; this is the part they share -
 * whether the box may open at all, and what to do with what was typed.
 */

const ILLEGAL = /[\\/:*?"<>|]/;

/** Whether the name may be edited. A file the portfolio owns says why not. */
export async function mayRename(path: string): Promise<boolean> {
  if (!containsSystemPath(path)) return true;
  await accessDenied("rename", path);
  return false;
}

/**
 * Applies the typed name. Nothing typed, or the same name, is a quiet no-op,
 * the way pressing Escape is. Returns the new path, or the old one.
 */
export function commitRename(path: string, typed: string): string {
  const next = typed.trim();
  const current = basename(path);
  if (!next || next === current) return path;

  const result = useFsStore.getState().rename(path, next);
  if (result !== null) return result;

  if (ILLEGAL.test(next)) {
    void errorDialog(
      "Rename",
      `A file name cannot contain any of the following characters:\n\\ / : * ? " < > |`
    );
  } else {
    void errorDialog(
      "Error Renaming File or Folder",
      `Cannot rename ${current}: A file with the name you specified already exists. Specify a different file name.`
    );
  }
  return path;
}
