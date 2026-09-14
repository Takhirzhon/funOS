import {
  useMemo,
  useState,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { blobUrlFor, isBinary, listEntries, useFsStore, type FsEntry } from "../store/fsStore";
import { useMenuStore } from "../store/menuStore";
import { useDndStore } from "../store/dndStore";
import { confirmDialog, errorDialog, promptDialog, propertiesDialog } from "../store/dialogStore";
import { useClipboardStore } from "../store/clipboardStore";
import { pasteInto } from "../fs/clipboard";
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
import { importFiles } from "../fs/import";
import { launchFile } from "../fs/open";
import { entryBytes, entryIcon, entryType } from "../fs/icons";
import { MenuBar } from "../components/MenuBar";
import { DriveIcon, FolderIcon } from "../icons";
import styles from "./Explorer.module.css";

type Props = { path?: string };

type ViewMode = "thumbnails" | "icons" | "list" | "details";

const VIEW_LABELS: Record<ViewMode, string> = {
  thumbnails: "Thumbnails",
  icons: "Icons",
  list: "List",
  details: "Details",
};

/* KB, rounded up, because that is what Explorer shows - a 12-byte file is
 * "1 KB" there too, and showing bytes would be more accurate and less familiar.
 */
const sizeLabel = (entry: FsEntry): string =>
  entry.kind === "dir" ? "" : `${Math.max(1, Math.ceil(entryBytes(entry) / 1024))} KB`;

const dateLabel = (ms: number) =>
  new Date(ms).toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export function Explorer({ path }: Props) {
  const entries = useFsStore((s) => s.entries);
  const mkdir = useFsStore((s) => s.mkdir);
  const writeFile = useFsStore((s) => s.writeFile);
  const remove = useFsStore((s) => s.remove);
  const move = useFsStore((s) => s.move);
  const rename = useFsStore((s) => s.rename);
  const uniquePath = useFsStore((s) => s.uniquePath);
  const openMenu = useMenuStore((s) => s.open);
  /* Highlighting a folder that a *desktop* drag is hovering over. HTML5 drag
   * events never fire for a pointer drag, so this is the only way Explorer
   * learns about one. */
  const hoverPath = useDndStore((s) => s.hoverPath);
  const clipboardPath = useClipboardStore((s) => s.path);
  const cutToClipboard = useClipboardStore((s) => s.cut);
  const copyToClipboard = useClipboardStore((s) => s.copy);

  const [nav, setNav] = useState(() => ({
    stack: [normalize(path ?? MY_DOCUMENTS)],
    index: 0,
  }));
  const current = nav.stack[nav.index];

  const [address, setAddress] = useState(() => display(current));
  const [selected, setSelected] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("icons");
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(ancestors(normalize(path ?? MY_DOCUMENTS)))
  );

  const items = useMemo(() => listEntries(entries, current), [entries, current]);

  const arriveAt = (target: string) => {
    setAddress(display(target));
    setSelected(null);
    setExpanded((prev) => new Set([...prev, ...ancestors(target)]));
  };

  const navigate = (to: string) => {
    const target = normalize(to);
    const entry = entries[target];
    if (!entry || entry.kind !== "dir") {
      void errorDialog("funOS", `${display(target)} is not accessible.\n\nThe path does not exist.`);
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
    if (entry.kind === "dir") navigate(entry.path);
    else launchFile(entry);
  };

  const newFolder = async () => {
    const suggested = uniquePath(current, "New Folder");
    const name = await promptDialog("New Folder", "Name the new folder:", basename(suggested));
    if (name === null) return;
    if (!mkdir(uniquePath(current, name.trim()))) {
      void errorDialog("New Folder", "That folder could not be created.");
    }
  };

  const newTextDocument = async () => {
    const suggested = uniquePath(current, "New Text Document.txt");
    const name = await promptDialog("New Text Document", "Name the new file:", basename(suggested));
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
        label: "View",
        submenu: (Object.keys(VIEW_LABELS) as ViewMode[]).map((mode) => ({
          kind: "item" as const,
          label: VIEW_LABELS[mode],
          bold: view === mode,
          onClick: () => setView(mode),
        })),
      },
      { kind: "separator" },
      {
        kind: "item",
        label: "New",
        submenu: [
          { kind: "item", label: "Folder", onClick: () => void newFolder() },
          { kind: "item", label: "Text Document", onClick: () => void newTextDocument() },
        ],
      },
      { kind: "separator" },
      {
        kind: "item",
        label: "Paste",
        disabled: clipboardPath === null,
        onClick: () => pasteInto(current),
      },
      { kind: "separator" },
      {
        kind: "item",
        label: "Properties",
        onClick: () => void propertiesDialog(current, basename(current)),
      },
    ]);
  };

  const itemMenu = (entry: FsEntry) => (e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelected(entry.path);
    openMenu(e.clientX, e.clientY, [
      { kind: "item", label: "Open", bold: true, onClick: () => openEntry(entry) },
      { kind: "separator" },
      { kind: "item", label: "Cut", onClick: () => cutToClipboard(entry.path) },
      { kind: "item", label: "Copy", onClick: () => copyToClipboard(entry.path) },
      {
        kind: "item",
        label: "Paste",
        /* Only meaningful on a folder - pasting "into" a file is not a thing. */
        disabled: clipboardPath === null || entry.kind !== "dir",
        onClick: () => pasteInto(entry.path),
      },
      { kind: "separator" },
      { kind: "item", label: "Rename", onClick: () => void renameEntry(entry) },
      { kind: "item", label: "Delete", onClick: () => void deleteEntry(entry) },
      { kind: "separator" },
      {
        kind: "item",
        label: "Properties",
        onClick: () => void propertiesDialog(entry.path, basename(entry.path)),
      },
    ]);
  };

  /* ---- Drag and drop ------------------------------------------------------ */

  const moveInto = (source: string, folder: string) => {
    if (move(source, folder) === null) {
      void errorDialog(
        "Move",
        `Cannot move '${basename(source)}' here: something with that name already exists, or that folder is inside the one being moved.`
      );
    }
  };

  const acceptsDrag = (e: ReactDragEvent) =>
    e.dataTransfer.types.includes(PATH_MIME) || e.dataTransfer.types.includes("Files");

  const dropOn = (folder: string) => (e: ReactDragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(null);
    const source = e.dataTransfer.getData(PATH_MIME);
    if (source) {
      moveInto(source, folder);
    } else if (e.dataTransfer.files.length) {
      void importFiles(e.dataTransfer.files, folder).then((error) => {
        if (error) void errorDialog("Copy", error);
      });
    }
  };

  const dragOver = (folder: string) => (e: ReactDragEvent) => {
    if (!acceptsDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setDropTarget(folder);
  };

  /** Highlighted because either drag system is hovering it. */
  const isDropTarget = (p: string) => dropTarget === p || hoverPath === p;

  const dragProps = (entry: FsEntry) => ({
    draggable: true,
    onDragStart: (e: ReactDragEvent) => {
      e.dataTransfer.setData(PATH_MIME, entry.path);
      e.dataTransfer.effectAllowed = "move";
    },
    onDragOver: entry.kind === "dir" ? dragOver(entry.path) : undefined,
    onDragLeave: () => setDropTarget(null),
    onDrop: entry.kind === "dir" ? dropOn(entry.path) : undefined,
    /* Advertised to the desktop's pointer drag, which cannot see HTML5 events. */
    "data-drop-path": entry.kind === "dir" ? entry.path : undefined,
  });

  const itemProps = (entry: FsEntry) => ({
    key: entry.path,
    type: "button" as const,
    onMouseDown: (e: ReactMouseEvent) => {
      e.stopPropagation();
      setSelected(entry.path);
    },
    onDoubleClick: () => openEntry(entry),
    onContextMenu: itemMenu(entry),
    ...dragProps(entry),
  });

  const stateClasses = (entry: FsEntry, base: string) =>
    [
      base,
      selected === entry.path ? styles.selected : "",
      isDropTarget(entry.path) ? styles.dropTarget : "",
    ].join(" ");

  const canBack = nav.index > 0;
  const canForward = nav.index < nav.stack.length - 1;
  const canUp = !isDriveRoot(current);

  return (
    <div className={styles.app}>
      <MenuBar
        menus={[
          {
            label: "File",
            items: [
              { label: "New Folder", onClick: () => void newFolder() },
              { label: "New Text Document", onClick: () => void newTextDocument() },
            ],
          },
          {
            label: "View",
            items: (Object.keys(VIEW_LABELS) as ViewMode[]).map((mode) => ({
              label: view === mode ? `• ${VIEW_LABELS[mode]}` : `   ${VIEW_LABELS[mode]}`,
              onClick: () => setView(mode),
            })),
          },
        ]}
      />

      <div className={styles.bar}>
        <span className={styles.grip} />
        <button type="button" className={styles.toolButton} disabled={!canBack} onClick={() => go(-1)}>
          ← Back
        </button>
        <button type="button" className={styles.toolButton} disabled={!canForward} onClick={() => go(1)}>
          → Forward
        </button>
        <button
          type="button"
          className={styles.toolButton}
          disabled={!canUp}
          onClick={() => navigate(dirname(current))}
        >
          ↑ Up
        </button>
        <span className={styles.grip} />
        <button
          type="button"
          className={styles.toolButton}
          title="Change the view"
          /* Cycles rather than opening a menu, which is what the toolbar button
           * does in XP too - the menu is on the arrow beside it. */
          onClick={() => {
            const order = Object.keys(VIEW_LABELS) as ViewMode[];
            setView(order[(order.indexOf(view) + 1) % order.length]);
          }}
        >
          Views: {VIEW_LABELS[view]}
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
          className={[
            styles.pane,
            styles[view],
            isDropTarget(current) ? styles.dropTarget : "",
          ].join(" ")}
          onContextMenu={backgroundMenu}
          onMouseDown={() => setSelected(null)}
          onDragOver={dragOver(current)}
          onDragLeave={() => setDropTarget(null)}
          onDrop={dropOn(current)}
          data-drop-path={current}
        >
          {items.length === 0 && <div className={styles.empty}>This folder is empty.</div>}

          {view === "details" ? (
            <>
              <div className={styles.headerRow}>
                <span>Name</span>
                <span>Size</span>
                <span>Type</span>
                <span>Date Modified</span>
              </div>
              {items.map((entry) => (
                <button {...itemProps(entry)} className={stateClasses(entry, styles.detailRow)}>
                  <span className={styles.cellName}>
                    {entryIcon(entry, 16)}
                    <span className={styles.ellipsis}>{basename(entry.path)}</span>
                  </span>
                  <span className={styles.cellSize}>{sizeLabel(entry)}</span>
                  <span className={styles.ellipsis}>{entryType(entry)}</span>
                  <span className={styles.ellipsis}>{dateLabel(entry.modified)}</span>
                </button>
              ))}
            </>
          ) : (
            items.map((entry) => (
              <button {...itemProps(entry)} className={stateClasses(entry, styles.item)}>
                <span className={styles.thumb}>
                  {view === "thumbnails" && isBinary(entry) && entry.mime?.startsWith("image/") ? (
                    <img className={styles.preview} src={blobUrlFor(entry)} alt="" />
                  ) : (
                    entryIcon(entry, view === "thumbnails" ? 48 : view === "list" ? 16 : 32)
                  )}
                </span>
                <span className={styles.itemLabel}>{basename(entry.path)}</span>
              </button>
            ))
          )}
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
