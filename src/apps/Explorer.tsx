import {
  useMemo,
  useState,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { listEntries, useFsStore, type FsEntry } from "../store/fsStore";
import { useWindowStore } from "../store/windowStore";
import { useMenuStore } from "../store/menuStore";
import { confirmDialog, errorDialog, promptDialog } from "../store/dialogStore";
import {
  ancestors,
  basename,
  dirname,
  display,
  extname,
  isDriveRoot,
  normalize,
} from "../fs/path";
import { MY_DOCUMENTS } from "../fs/seed";
import { PATH_MIME } from "../fs/dnd";
import { DriveIcon, FileIcon, FolderIcon, NotepadIcon } from "../icons";
import styles from "./Explorer.module.css";

type Props = { path?: string };

const iconFor = (entry: FsEntry, size: number) => {
  if (entry.kind === "dir") return <FolderIcon size={size} />;
  return extname(entry.path) === ".txt" ? (
    <NotepadIcon size={size} />
  ) : (
    <FileIcon size={size} />
  );
};

export function Explorer({ path }: Props) {
  const entries = useFsStore((s) => s.entries);
  const mkdir = useFsStore((s) => s.mkdir);
  const writeFile = useFsStore((s) => s.writeFile);
  const remove = useFsStore((s) => s.remove);
  const move = useFsStore((s) => s.move);
  const rename = useFsStore((s) => s.rename);
  const uniquePath = useFsStore((s) => s.uniquePath);
  const openWindow = useWindowStore((s) => s.open);
  const openMenu = useMenuStore((s) => s.open);

  /* Back and forward are a stack and a cursor, not two stacks. Navigating from
   * the middle of the history truncates everything ahead of it, which is what
   * every browser and every Explorer does and what people expect.
   */
  const [nav, setNav] = useState(() => ({
    stack: [normalize(path ?? MY_DOCUMENTS)],
    index: 0,
  }));
  const current = nav.stack[nav.index];

  const [address, setAddress] = useState(() => display(current));
  const [selected, setSelected] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(ancestors(normalize(path ?? MY_DOCUMENTS)))
  );

  const items = useMemo(() => listEntries(entries, current), [entries, current]);

  /* The address bar and the selection are updated by whatever navigates, not by
   * an effect watching `current`. An effect would also fire while someone is
   * halfway through typing a path, and rewrite what they were typing.
   */
  const arriveAt = (target: string) => {
    setAddress(display(target));
    setSelected(null);
    setExpanded((prev) => new Set([...prev, ...ancestors(target)]));
  };

  const navigate = (to: string) => {
    const target = normalize(to);
    const entry = entries[target];
    if (!entry || entry.kind !== "dir") {
      void errorDialog(
        "funOS",
        `${display(target)} is not accessible.\n\nThe path does not exist.`
      );
      setAddress(display(current));
      return;
    }
    if (target === current) return;
    setNav((n) => ({ stack: [...n.stack.slice(0, n.index + 1), target], index: n.index + 1 }));
    arriveAt(target);
  };

  /** Back and Forward: move the cursor without touching the stack. */
  const go = (delta: number) => {
    const index = nav.index + delta;
    const target = nav.stack[index];
    if (!target) return;
    setNav({ ...nav, index });
    arriveAt(target);
  };

  const openEntry = (entry: FsEntry) => {
    if (entry.kind === "dir") {
      navigate(entry.path);
      return;
    }
    /* Everything opens in Notepad, because Notepad is the only editor there is.
     * When that stops being true this becomes a lookup by extension. */
    openWindow("notepad", {
      title: `${basename(entry.path)} - Notepad`,
      bounds: { width: 560, height: 420 },
      props: { path: entry.path },
    });
  };

  const newFolder = async () => {
    const target = uniquePath(current, "New Folder");
    const name = await promptDialog("New Folder", "Name the new folder:", basename(target));
    if (name === null) return;
    if (!mkdir(uniquePath(current, name.trim()))) {
      void errorDialog("New Folder", "That folder could not be created.");
    }
  };

  const newTextDocument = async () => {
    const target = uniquePath(current, "New Text Document.txt");
    const name = await promptDialog("New Text Document", "Name the new file:", basename(target));
    if (name === null) return;
    const withExt = extname(name) ? name.trim() : `${name.trim()}.txt`;
    if (!writeFile(uniquePath(current, withExt), "")) {
      void errorDialog("New Text Document", "That file could not be created.");
    }
  };

  const renameEntry = async (entry: FsEntry) => {
    const next = await promptDialog("Rename", "New name:", basename(entry.path));
    if (next === null) return;
    const result = rename(entry.path, next);
    if (result === null) {
      void errorDialog(
        "Rename",
        `Cannot rename ${basename(entry.path)}: a file with that name already exists, or the name contains an illegal character.`
      );
      return;
    }
    setSelected(result);
  };

  const deleteEntry = async (entry: FsEntry) => {
    const what = entry.kind === "dir" ? "folder and everything in it" : "file";
    const ok = await confirmDialog(
      "Confirm Delete",
      `Are you sure you want to delete this ${what}?\n\n${basename(entry.path)}`
    );
    if (!ok) return;
    remove(entry.path);
    if (selected === entry.path) setSelected(null);
  };

  const backgroundMenu = (e: ReactMouseEvent) => {
    e.preventDefault();
    setSelected(null);
    openMenu(e.clientX, e.clientY, [
      {
        kind: "item",
        label: "New",
        submenu: [
          { kind: "item", label: "Folder", onClick: () => void newFolder() },
          { kind: "item", label: "Text Document", onClick: () => void newTextDocument() },
        ],
      },
      { kind: "separator" },
      { kind: "item", label: "Paste", disabled: true },
      { kind: "separator" },
      { kind: "item", label: "Properties", disabled: true },
    ]);
  };

  const itemMenu = (entry: FsEntry) => (e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelected(entry.path);
    openMenu(e.clientX, e.clientY, [
      { kind: "item", label: "Open", bold: true, onClick: () => openEntry(entry) },
      { kind: "separator" },
      { kind: "item", label: "Rename", onClick: () => void renameEntry(entry) },
      { kind: "item", label: "Delete", onClick: () => void deleteEntry(entry) },
      { kind: "separator" },
      { kind: "item", label: "Properties", disabled: true },
    ]);
  };

  /* ---- Drag and drop -----------------------------------------------------
   * Explorer is both a source and a target. Dragging an item out sets the path
   * on the dataTransfer; dropping onto a folder - or onto empty space, meaning
   * the folder being viewed - moves it. Real files from the host operating
   * system are imported instead.
   */
  const moveInto = (source: string, folder: string) => {
    if (move(source, folder) === null) {
      void errorDialog(
        "Move",
        `Cannot move '${basename(source)}' here: something with that name already exists, or that folder is inside the one being moved.`
      );
    }
  };

  const importFiles = (list: FileList, folder: string) => {
    void (async () => {
      for (const file of Array.from(list)) {
        if (file.size > 1_000_000) {
          void errorDialog("Copy", `${file.name} is too large to copy here.`);
          continue;
        }
        writeFile(uniquePath(folder, file.name), await file.text());
      }
    })();
  };

  const acceptsDrag = (e: ReactDragEvent) =>
    e.dataTransfer.types.includes(PATH_MIME) || e.dataTransfer.types.includes("Files");

  const dropOn = (folder: string) => (e: ReactDragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(null);
    const source = e.dataTransfer.getData(PATH_MIME);
    if (source) moveInto(source, folder);
    else if (e.dataTransfer.files.length) importFiles(e.dataTransfer.files, folder);
  };

  const canBack = nav.index > 0;
  const canForward = nav.index < nav.stack.length - 1;
  const canUp = !isDriveRoot(current);

  return (
    <div className={styles.app}>
      <div className={styles.bar}>
        <span className={styles.grip} />
        <button
          type="button"
          className={styles.toolButton}
          disabled={!canBack}
          onClick={() => go(-1)}
          title="Back"
        >
          ← Back
        </button>
        <button
          type="button"
          className={styles.toolButton}
          disabled={!canForward}
          onClick={() => go(1)}
          title="Forward"
        >
          → Forward
        </button>
        <button
          type="button"
          className={styles.toolButton}
          disabled={!canUp}
          onClick={() => navigate(dirname(current))}
          title="Up One Level"
        >
          ↑ Up
        </button>
      </div>

      <div className={styles.bar}>
        <span className={styles.grip} />
        <span className={styles.addressLabel}>Address</span>
        <input
          className={styles.address}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") navigate(address);
            if (e.key === "Escape") setAddress(display(current));
          }}
          spellCheck={false}
        />
        <button type="button" className={styles.toolButton} onClick={() => navigate(address)}>
          Go
        </button>
      </div>

      <div className={styles.main}>
        <div className={styles.tree}>
          <TreeNode
            path={normalize("C:")}
            depth={0}
            entries={entries}
            current={current}
            expanded={expanded}
            onToggle={(p) =>
              setExpanded((prev) => {
                const next = new Set(prev);
                if (next.has(p)) next.delete(p);
                else next.add(p);
                return next;
              })
            }
            onSelect={navigate}
          />
        </div>

        <div
          className={
            dropTarget === current ? `${styles.list} ${styles.dropTarget}` : styles.list
          }
          onContextMenu={backgroundMenu}
          onMouseDown={() => setSelected(null)}
          onDragOver={(e) => {
            if (!acceptsDrag(e)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            setDropTarget(current);
          }}
          onDragLeave={() => setDropTarget(null)}
          onDrop={dropOn(current)}
        >
          {items.length === 0 && <div className={styles.empty}>This folder is empty.</div>}
          {items.map((entry) => (
            <button
              key={entry.path}
              type="button"
              className={[
                styles.item,
                selected === entry.path ? styles.selected : "",
                dropTarget === entry.path ? styles.dropTarget : "",
              ].join(" ")}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(PATH_MIME, entry.path);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                if (entry.kind !== "dir" || !acceptsDrag(e)) return;
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = "move";
                setDropTarget(entry.path);
              }}
              onDragLeave={() => setDropTarget(null)}
              onDrop={entry.kind === "dir" ? dropOn(entry.path) : undefined}
              onMouseDown={(e) => {
                e.stopPropagation();
                setSelected(entry.path);
              }}
              onDoubleClick={() => openEntry(entry)}
              onContextMenu={itemMenu(entry)}
            >
              {iconFor(entry, 32)}
              <span className={styles.itemLabel}>{basename(entry.path)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.status}>
        <div className={styles.statusField}>
          {items.length} object{items.length === 1 ? "" : "s"}
          {selected ? ` — ${basename(selected)} selected` : ""}
        </div>
        <div className={styles.statusField}>My Computer</div>
      </div>
    </div>
  );
}

type TreeProps = {
  path: string;
  depth: number;
  entries: Record<string, FsEntry>;
  current: string;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
};

function TreeNode({ path, depth, entries, current, expanded, onToggle, onSelect }: TreeProps) {
  const children = useMemo(
    () => listEntries(entries, path).filter((e) => e.kind === "dir"),
    [entries, path]
  );
  const isOpen = expanded.has(path);
  const label = isDriveRoot(path) ? `Local Disk (${path})` : basename(path);

  return (
    <>
      <div
        className={path === current ? `${styles.row} ${styles.current}` : styles.row}
        style={{ paddingLeft: depth * 14 }}
      >
        {children.length > 0 ? (
          <button
            type="button"
            className={styles.twisty}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(path);
            }}
            aria-label={isOpen ? "Collapse" : "Expand"}
          >
            {isOpen ? "−" : "+"}
          </button>
        ) : (
          <span className={styles.twistySpacer} />
        )}
        <button type="button" className={styles.nodeLabel} onClick={() => onSelect(path)}>
          {isDriveRoot(path) ? <DriveIcon size={16} /> : <FolderIcon size={16} />}
          {label}
        </button>
      </div>

      {isOpen &&
        children.map((child) => (
          <TreeNode
            key={child.path}
            path={child.path}
            depth={depth + 1}
            entries={entries}
            current={current}
            expanded={expanded}
            onToggle={onToggle}
            onSelect={onSelect}
          />
        ))}
    </>
  );
}
