import { useEffect, useMemo, useState } from "react";
import { isBinary, useFsStore } from "../store/fsStore";
import { useWindowStore } from "../store/windowStore";
import { confirmDialog, errorDialog, fileDialog } from "../store/dialogStore";
import { basename, dirname, display, extname, normalize } from "../fs/path";
import { MY_DOCUMENTS } from "../fs/seed";
import { MenuBar } from "../components/MenuBar";
import styles from "./Notepad.module.css";

type Props = {
  /** Set when Explorer launches it. Absent means a new, unsaved document. */
  path?: string;
  /** The window this instance lives in, so the caption can follow the file. */
  windowId?: string;
};

export function Notepad({ path, windowId }: Props) {
  const readFile = useFsStore((s) => s.readFile);
  const writeFile = useFsStore((s) => s.writeFile);
  const exists = useFsStore((s) => s.exists);
  const setTitle = useWindowStore((s) => s.setTitle);

  const initial = useMemo(() => (path ? (readFile(path) ?? "") : ""), [path, readFile]);

  const [file, setFile] = useState<string | null>(path ? normalize(path) : null);
  const [text, setText] = useState(initial);
  const [savedText, setSavedText] = useState(initial);

  const dirty = text !== savedText;
  const name = file ? basename(file) : "Untitled";

  /* The caption belongs to the window, not to the app, so the taskbar button
   * and the title bar agree - and so "Save As" renames both at once.
   */
  useEffect(() => {
    if (windowId) setTitle(windowId, `${dirty ? "*" : ""}${name} - Notepad`);
  }, [windowId, name, dirty, setTitle]);

  const save = (target: string | null = file): boolean => {
    if (!target) return false;
    if (!writeFile(target, text)) {
      void errorDialog("Notepad", `Cannot save ${display(target)}.\n\nThe folder does not exist.`);
      return false;
    }
    setFile(target);
    setSavedText(text);
    return true;
  };

  const saveAs = async () => {
    const picked = await fileDialog("save", file ? dirname(file) : MY_DOCUMENTS, name);
    if (picked === null) return false;

    /* Default the extension, the way Notepad does: a file saved as "notes"
     * becomes notes.txt, because otherwise nothing later knows to open it as
     * text. */
    const target = extname(picked) ? picked : `${picked}.txt`;

    if (target !== file && exists(target)) {
      const ok = await confirmDialog(
        "Save As",
        `${basename(target)} already exists.\nDo you want to replace it?`
      );
      if (!ok) return false;
    }
    return save(target);
  };

  /* Returns false when the user cancelled, so the caller can abandon whatever
   * it was about to do. This is the whole reason New and Open ask first. */
  const confirmDiscard = async (): Promise<boolean> => {
    if (!dirty) return true;
    const keep = await confirmDialog(
      "Notepad",
      `The text in the ${name} file has changed.\n\nDo you want to save the changes?`
    );
    if (!keep) return true;
    return file ? save() : await saveAs();
  };

  const newDoc = async () => {
    if (!(await confirmDiscard())) return;
    setFile(null);
    setText("");
    setSavedText("");
  };

  const openDoc = async () => {
    if (!(await confirmDiscard())) return;
    const picked = await fileDialog(
      "open",
      file ? dirname(file) : MY_DOCUMENTS,
      file ? basename(file) : ""
    );
    if (picked === null) return;

    const target = normalize(picked);
    /* Notepad on a PNG does not fail, it fills the window with mojibake - which
     * looks like a corrupt file rather than the wrong program. */
    if (isBinary(useFsStore.getState().get(target))) {
      void errorDialog("Open", `${display(target)}\n\nThis is not a text file.`);
      return;
    }
    const content = readFile(target);
    if (content === undefined) {
      void errorDialog("Open", `${display(target)}\n\nFile not found.`);
      return;
    }
    setFile(target);
    setText(content);
    setSavedText(content);
  };

  return (
    <div className={styles.app}>
      <MenuBar
        menus={[
          {
            label: "File",
            items: [
              { label: "New", onClick: () => void newDoc() },
              { label: "Open...", onClick: () => void openDoc() },
              { label: "Save", onClick: () => void (file ? save() : saveAs()) },
              { label: "Save As...", onClick: () => void saveAs() },
            ],
          },
          {
            label: "Edit",
            items: [
              {
                label: "Select All",
                onClick: () => {
                  const area = document.activeElement;
                  if (area instanceof HTMLTextAreaElement) area.select();
                },
              },
              { label: "Time/Date", onClick: () => setText((t) => t + new Date().toLocaleString()) },
            ],
          },
          {
            label: "Help",
            items: [
              {
                label: "About Notepad",
                onClick: () =>
                  void errorDialog(
                    "About Notepad",
                    "funOS Notepad\n\nReads and writes the virtual file system, which lives in IndexedDB and survives a reload."
                  ),
              },
            ],
          },
        ]}
      />

      <textarea
        className={styles.editor}
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
      />

      <div className={styles.status}>
        <span>{file ? display(file) : "Untitled"}</span>
        <span>
          {text.length} chars{dirty ? " — unsaved" : ""}
        </span>
      </div>
    </div>
  );
}
