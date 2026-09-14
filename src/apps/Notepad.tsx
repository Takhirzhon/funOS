import { useEffect, useMemo, useState } from "react";
import { useFsStore } from "../store/fsStore";
import { useWindowStore } from "../store/windowStore";
import { confirmDialog, errorDialog, promptDialog } from "../store/dialogStore";
import { basename, dirname, display, extname, join, normalize } from "../fs/path";
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
    const folder = file ? dirname(file) : MY_DOCUMENTS;
    const entered = await promptDialog("Save As", `Save in ${display(folder)}:`, name, "Save");
    if (entered === null) return false;

    const withExt = extname(entered) ? entered.trim() : `${entered.trim()}.txt`;
    const target = join(folder, withExt);

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
    const entered = await promptDialog(
      "Open",
      "Type the full path of the file to open:",
      file ?? `${display(MY_DOCUMENTS)}\\readme.txt`,
      "Open"
    );
    if (entered === null) return;

    const target = normalize(entered);
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
