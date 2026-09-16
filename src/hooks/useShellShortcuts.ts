import { useEffect, useRef } from "react";
import { useClipboardStore } from "../store/clipboardStore";
import { useDialogStore } from "../store/dialogStore";
import { useMenuStore } from "../store/menuStore";
import { pasteInto } from "../fs/clipboard";
import { deletePaths } from "../fs/trash";

type Options = {
  /* Whether this surface currently owns the keyboard.
   *
   * This is the whole problem the hook exists to solve. The desktop and every
   * Explorer window would each like to answer Ctrl+C, and a listener per
   * surface means every one of them answers at once. Exactly one is allowed to
   * be active, and the caller decides which - the desktop when no window has
   * focus, an Explorer window when it is the focused one.
   */
  active: boolean;
  /** The paths the shortcuts act on. Empty when nothing is selected. */
  selected: string[];
  /** Where Paste puts things. */
  folder: string;
  /** Called after a successful delete, so the caller can clear its selection. */
  onDeleted?: (paths: string[]) => void;
  /** F2, with exactly one thing selected: open the rename box on it. */
  onRename?: (path: string) => void;
};

export function useShellShortcuts({ active, selected, folder, onDeleted, onRename }: Options) {
  /* The listener is installed once per activation and reads everything else
   * through a ref. Putting `selected` in the dependency array would tear the
   * listener down and build it up again on every click.
   */
  const latest = useRef({ selected, folder, onDeleted, onRename });
  useEffect(() => {
    latest.current = { selected, folder, onDeleted, onRename };
  }, [selected, folder, onDeleted, onRename]);

  useEffect(() => {
    if (!active) return;

    const onKey = (e: KeyboardEvent) => {
      /* Three things that are not a shell shortcut even when they look like
       * one: typing into a field, a modal dialog waiting for an answer, and an
       * open context menu. Ctrl+C in a rename box must copy the text. */
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
      if (useDialogStore.getState().request) return;
      if (useMenuStore.getState().items) return;

      const { selected: paths, folder: target, onDeleted: done, onRename: rename } = latest.current;
      const clipboard = useClipboardStore.getState();

      if (e.ctrlKey && !e.altKey) {
        const key = e.key.toLowerCase();
        if (key === "x" && paths.length) {
          e.preventDefault();
          clipboard.cut(paths);
          return;
        }
        if (key === "c" && paths.length) {
          e.preventDefault();
          clipboard.copy(paths);
          return;
        }
        if (key === "v" && clipboard.paths.length) {
          e.preventDefault();
          pasteInto(target);
          return;
        }
        return;
      }

      if (e.key === "F2" && paths.length === 1 && rename) {
        e.preventDefault();
        rename(paths[0]);
        return;
      }

      if (e.key === "Delete" && paths.length) {
        e.preventDefault();
        /* Shift+Delete skips the Recycle Bin, which is the one keyboard
         * shortcut in Windows that people know and expect to be destructive. */
        void deletePaths(paths, e.shiftKey).then((deleted) => {
          if (deleted.length) done?.(deleted);
        });
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);
}
