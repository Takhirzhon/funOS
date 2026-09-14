import { create } from "zustand";
import { playSound } from "./soundStore";

/* Modal dialogs, as a promise.
 *
 * The browser already has prompt(), confirm() and alert(), and they are the one
 * thing that cannot be made to look like anything: a Chrome dialog dropping out
 * of the top of the viewport instantly breaks the illusion that this is a
 * machine. They also block the main thread, which stops every animation on the
 * desktop while they are up.
 *
 * So: one dialog at a time, held in a store, resolved through a promise so
 * calling code still reads like `if (await confirmDialog(...))`.
 */

export type DialogRequest =
  | { kind: "prompt"; title: string; label: string; value: string; okLabel: string }
  | { kind: "confirm"; title: string; message: string }
  | { kind: "error"; title: string; message: string }
  | { kind: "properties"; title: string; paths: string[] }
  /* The file picker. `mode` decides the button label and whether an existing
   * name is a warning ("replace?") or the whole point. */
  | {
      kind: "file";
      title: string;
      mode: "open" | "save";
      folder: string;
      fileName: string;
    };

type DialogStore = {
  request: DialogRequest | null;
  /* Increments on every ask, and is the React key of the dialog body.
   *
   * Without it, two dialogs that happen to match - renaming one file and then
   * another, both "Rename" prompts - reuse the same element, and the input box
   * still holds the first file's name because its state never remounted.
   */
  seq: number;
  /** Resolver for the dialog currently on screen. */
  resolve: ((value: string | boolean | null) => void) | null;
  close: (value: string | boolean | null) => void;
  ask: (request: DialogRequest) => Promise<string | boolean | null>;
};

export const useDialogStore = create<DialogStore>((set, get) => ({
  request: null,
  seq: 0,
  resolve: null,

  ask: (request) =>
    new Promise((resolve) => {
      /* One at a time. If something opens a dialog while another is up, the
       * first is answered as cancelled rather than left hanging - a promise
       * nobody ever resolves is a window that never closes. */
      const previous = get().resolve;
      if (previous) previous(null);
      /* The ding belongs to the error dialog rather than to each caller: it is
       * the dialog that is the error, and forty call sites would forget. */
      if (request.kind === "error") playSound("ding");
      set((s) => ({ request, resolve, seq: s.seq + 1 }));
    }),

  close: (value) => {
    const { resolve } = get();
    set({ request: null, resolve: null });
    resolve?.(value);
  },
}));

export const promptDialog = (
  title: string,
  label: string,
  value = "",
  okLabel = "OK"
): Promise<string | null> =>
  useDialogStore
    .getState()
    .ask({ kind: "prompt", title, label, value, okLabel })
    .then((result) => (typeof result === "string" ? result : null));

export const confirmDialog = (title: string, message: string): Promise<boolean> =>
  useDialogStore
    .getState()
    .ask({ kind: "confirm", title, message })
    .then((result) => result === true);

export const propertiesDialog = (paths: string[], name: string): Promise<void> =>
  useDialogStore
    .getState()
    .ask({
      kind: "properties",
      /* Windows titles a multiple selection by its count, not by the first
       * item - naming one of five is worse than naming none. */
      title: paths.length === 1 ? `${name} Properties` : `${paths.length} items Properties`,
      paths,
    })
    .then(() => undefined);

/** Resolves to a canonical path, or null if the picker was cancelled. */
export const fileDialog = (
  mode: "open" | "save",
  folder: string,
  fileName = ""
): Promise<string | null> =>
  useDialogStore
    .getState()
    .ask({
      kind: "file",
      title: mode === "open" ? "Open" : "Save As",
      mode,
      folder,
      fileName,
    })
    .then((result) => (typeof result === "string" ? result : null));

export const errorDialog = (title: string, message: string): Promise<void> =>
  useDialogStore
    .getState()
    .ask({ kind: "error", title, message })
    .then(() => undefined);
