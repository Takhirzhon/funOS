/* The MIME types an internal drag carries.
 *
 * Its own module so that the desktop and Explorer can both use it without
 * importing each other - Explorer is in the app registry, the desktop reads the
 * registry, and a constant shared directly between them would close that loop.
 *
 * A custom type rather than "text/plain" on purpose: it means a path dragged
 * out of funOS does nothing when dropped into a text editor in the host
 * operating system, instead of pasting "C:/Documents and Settings/..." into it.
 *
 * Two types, because a drag is a list now. PATH_MIME is the one the gesture
 * started on, as it always was; PATHS_MIME is the whole selection as JSON.
 * A drop reads the list and falls back to the one, so a drag from anything
 * that only sets the old type still lands.
 */
export const PATH_MIME = "application/x-funos-path";
export const PATHS_MIME = "application/x-funos-paths";

export function setDragPaths(dt: DataTransfer, paths: string[]): void {
  dt.setData(PATH_MIME, paths[0] ?? "");
  dt.setData(PATHS_MIME, JSON.stringify(paths));
  dt.effectAllowed = "move";
}

export function getDragPaths(dt: DataTransfer): string[] {
  try {
    const list: unknown = JSON.parse(dt.getData(PATHS_MIME) || "[]");
    if (Array.isArray(list) && list.length > 0 && list.every((p) => typeof p === "string")) {
      return list as string[];
    }
  } catch {
    /* Not ours, or not a list. */
  }
  const one = dt.getData(PATH_MIME);
  return one ? [one] : [];
}

export const isPathDrag = (dt: DataTransfer): boolean => dt.types.includes(PATH_MIME);
