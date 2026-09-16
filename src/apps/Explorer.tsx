import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { blobUrlFor, isBinary, isHiddenEntry, listEntries, useFsStore, type FsEntry } from "../store/fsStore";
import { useFolderOptions } from "../store/folderOptions";
import { useMenuStore } from "../store/menuStore";
import { useDndStore } from "../store/dndStore";
import { errorDialog, promptDialog, propertiesDialog } from "../store/dialogStore";
import { useClipboardStore } from "../store/clipboardStore";
import { pasteInto } from "../fs/clipboard";
import { deletePaths } from "../fs/trash";
import { useShellShortcuts } from "../hooks/useShellShortcuts";
import { COARSE, useMediaQuery } from "../hooks/useMediaQuery";
import { useWindowStore } from "../store/windowStore";
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
import { getDragPaths, isPathDrag, setDragPaths } from "../fs/dnd";
import { moveInto } from "../fs/move";
import { importFiles } from "../fs/import";
import { launchFile } from "../fs/open";
import { accessDenied, containsSystemPath } from "../fs/system";
import { entryBytes, entryIcon, entryType } from "../fs/icons";
import { MenuBar } from "../components/MenuBar";
import { DriveIcon } from "../icons";
import styles from "./Explorer.module.css";

type Props = { path?: string; windowId?: string };

type ViewMode = "thumbnails" | "icons" | "list" | "details";

const VIEWS_KEY = "funos.explorer.views";
const VIEW_MODES: ViewMode[] = ["thumbnails", "icons", "list", "details"];

const loadViews = (): Record<string, ViewMode> => {
  try {
    const raw = localStorage.getItem(VIEWS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    const out: Record<string, ViewMode> = {};
    if (parsed && typeof parsed === "object") {
      for (const [path, mode] of Object.entries(parsed as Record<string, unknown>)) {
        if (VIEW_MODES.includes(mode as ViewMode)) out[path] = mode as ViewMode;
      }
    }
    return out;
  } catch {
    return {};
  }
};

const saveViews = (views: Record<string, ViewMode>) => {
  try {
    localStorage.setItem(VIEWS_KEY, JSON.stringify(views));
  } catch {
    /* Private mode. */
  }
};

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

export function Explorer({ path, windowId }: Props) {
  const entries = useFsStore((s) => s.entries);
  const mkdir = useFsStore((s) => s.mkdir);
  const writeFile = useFsStore((s) => s.writeFile);
  const rename = useFsStore((s) => s.rename);
  const uniquePath = useFsStore((s) => s.uniquePath);
  const openMenu = useMenuStore((s) => s.open);
  /* Highlighting a folder that a *desktop* drag is hovering over. HTML5 drag
   * events never fire for a pointer drag, so this is the only way Explorer
   * learns about one. */
  const hoverPath = useDndStore((s) => s.hoverPath);
  const clipboardPaths = useClipboardStore((s) => s.paths);
  const clipboardMode = useClipboardStore((s) => s.mode);
  const focusedWindow = useWindowStore((s) => s.focusedId);
  const coarse = useMediaQuery(COARSE);
  const showHidden = useFolderOptions((s) => s.showHidden);
  const setShowHidden = useFolderOptions((s) => s.setShowHidden);
  const cutToClipboard = useClipboardStore((s) => s.cut);
  const copyToClipboard = useClipboardStore((s) => s.copy);

  const [nav, setNav] = useState(() => ({
    stack: [normalize(path ?? MY_DOCUMENTS)],
    index: 0,
  }));
  const current = nav.stack[nav.index];

  const [address, setAddress] = useState(() => display(current));
  /* A list. Plain click replaces it, Ctrl+click toggles one, Shift+click
   * extends from the anchor - the three gestures every file list has. */
  const [selected, setSelected] = useState<string[]>([]);
  const anchor = useRef<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  /* The marquee: a rectangle dragged out on the pane's background, in the
   * pane's own scrolled coordinates, selecting whatever it crosses. Mouse
   * only - on a finger a drag across the pane is a scroll. */
  const paneRef = useRef<HTMLDivElement>(null);
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const marqueeRef = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  /* The view, per folder, remembered: XP kept each folder's view and so
   * does this, in localStorage. Thumbnails is the default because a folder
   * of photographs is what most visitors open, and a grid of identical
   * picture icons says nothing about them. */
  const [views, setViews] = useState<Record<string, ViewMode>>(loadViews);
  const view: ViewMode = views[current] ?? "thumbnails";
  const setView = (mode: ViewMode) =>
    setViews((prev) => {
      const next = { ...prev, [current]: mode };
      saveViews(next);
      return next;
    });
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(ancestors(normalize(path ?? MY_DOCUMENTS)))
  );

  const items = useMemo(
    () => listEntries(entries, current, showHidden ? "attribute" : false),
    [entries, current, showHidden]
  );

  const arriveAt = (target: string) => {
    setAddress(display(target));
    setSelected([]);
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
    if (containsSystemPath(entry.path)) {
      await accessDenied("rename", entry.path);
      return;
    }
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
    setSelected([result]);
  };

  /* The three click gestures of every file list.
   *
   * Shift extends from the anchor - the item the last plain click landed on -
   * rather than from the previously selected item. Extending from "whatever was
   * last touched" is the version that makes a shift-click after a ctrl-click
   * select a range nobody asked for.
   */
  const selectOn = (e: ReactMouseEvent, path: string) => {
    if (e.shiftKey && anchor.current) {
      const from = items.findIndex((i) => i.path === anchor.current);
      const to = items.findIndex((i) => i.path === path);
      if (from !== -1 && to !== -1) {
        const [lo, hi] = from < to ? [from, to] : [to, from];
        setSelected(items.slice(lo, hi + 1).map((i) => i.path));
        return;
      }
    }
    if (e.ctrlKey) {
      anchor.current = path;
      setSelected((prev) =>
        prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
      );
      return;
    }
    anchor.current = path;
    setSelected([path]);
  };

  /* Acts on the whole selection when the clicked item is part of it, and on
   * just that item when it is not - which is what right-clicking outside a
   * selection means everywhere else. */
  const targetsFor = (path: string) => (selected.includes(path) ? selected : [path]);

  const deleteEntry = async (entry: FsEntry) => {
    const deleted = await deletePaths(targetsFor(entry.path));
    if (deleted.length) setSelected((prev) => prev.filter((p) => !deleted.includes(p)));
  };

  useShellShortcuts({
    active: windowId !== undefined && focusedWindow === windowId,
    selected,
    folder: current,
    onDeleted: (paths) => setSelected((prev) => prev.filter((p) => !paths.includes(p))),
  });

  const backgroundMenu = (e: ReactMouseEvent) => {
    e.preventDefault();
    setSelected([]);
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
        disabled: clipboardPaths.length === 0,
        onClick: () => pasteInto(current),
      },
      { kind: "separator" },
      {
        kind: "item",
        label: "Properties",
        onClick: () => void propertiesDialog([current], basename(current)),
      },
    ]);
  };

  const itemMenu = (entry: FsEntry) => (e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selected.includes(entry.path)) setSelected([entry.path]);
    openMenu(e.clientX, e.clientY, [
      { kind: "item", label: "Open", bold: true, onClick: () => openEntry(entry) },
      { kind: "separator" },
      { kind: "item", label: "Cut", onClick: () => cutToClipboard(targetsFor(entry.path)) },
      { kind: "item", label: "Copy", onClick: () => copyToClipboard(targetsFor(entry.path)) },
      {
        kind: "item",
        label: "Paste",
        /* Only meaningful on a folder - pasting "into" a file is not a thing. */
        disabled: clipboardPaths.length === 0 || entry.kind !== "dir",
        onClick: () => pasteInto(entry.path),
      },
      { kind: "separator" },
      { kind: "item", label: "Rename", onClick: () => void renameEntry(entry) },
      { kind: "item", label: "Delete", onClick: () => void deleteEntry(entry) },
      { kind: "separator" },
      {
        kind: "item",
        label: "Properties",
        onClick: () => void propertiesDialog(targetsFor(entry.path), basename(entry.path)),
      },
    ]);
  };

  /* ---- Marquee ---------------------------------------------------------- */

  const beginMarquee = (e: ReactPointerEvent<HTMLDivElement>) => {
    /* Only from the pane's own background. The items stop mousedown, which
     * is what the selection listens to; pointerdown still bubbles. */
    if ((e.target as HTMLElement).closest("[data-path]")) return;
    if (e.button !== 0 || e.pointerType !== "mouse") {
      setSelected([]);
      return;
    }
    const pane = paneRef.current;
    if (!pane) return;
    const r = pane.getBoundingClientRect();
    const start = {
      x0: e.clientX - r.left + pane.scrollLeft,
      y0: e.clientY - r.top + pane.scrollTop,
      x1: e.clientX - r.left + pane.scrollLeft,
      y1: e.clientY - r.top + pane.scrollTop,
    };
    marqueeRef.current = start;
    setMarquee(start);
    if (!e.ctrlKey) setSelected([]);
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const m = marqueeRef.current;
      const pane = paneRef.current;
      if (!m || !pane) return;
      const r = pane.getBoundingClientRect();
      m.x1 = e.clientX - r.left + pane.scrollLeft;
      m.y1 = e.clientY - r.top + pane.scrollTop;
      setMarquee({ ...m });

      /* Hit-test against the items as drawn, in the same scrolled space. */
      const left = Math.min(m.x0, m.x1);
      const top = Math.min(m.y0, m.y1);
      const right = Math.max(m.x0, m.x1);
      const bottom = Math.max(m.y0, m.y1);
      const hit: string[] = [];
      for (const el of pane.querySelectorAll<HTMLElement>("[data-path]")) {
        const b = el.getBoundingClientRect();
        const x0 = b.left - r.left + pane.scrollLeft;
        const y0 = b.top - r.top + pane.scrollTop;
        if (x0 < right && x0 + b.width > left && y0 < bottom && y0 + b.height > top) {
          hit.push(el.dataset.path!);
        }
      }
      setSelected(hit);
    };
    const onUp = () => {
      if (!marqueeRef.current) return;
      marqueeRef.current = null;
      setMarquee(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  /* ---- Drag and drop ------------------------------------------------------ */

  const acceptsDrag = (e: ReactDragEvent) => isPathDrag(e.dataTransfer) || e.dataTransfer.types.includes("Files");

  const dropOn = (folder: string) => (e: ReactDragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(null);
    const sources = getDragPaths(e.dataTransfer);
    if (sources.length) {
      moveInto(sources, folder);
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
      /* The whole selection, when the gesture starts on a member of it. */
      setDragPaths(e.dataTransfer, targetsFor(entry.path));
    },
    /* A drag that landed where nothing accepted it - the toolbar, another
     * program's window - ends with no effect and no word, which for a file
     * that could not have moved anyway reads as "I dragged it and nothing
     * happened". A target that did accept it has already said why; this is
     * for the ones that did not. */
    onDragEnd: (e: ReactDragEvent) => {
      setDropTarget(null);
      const owned = targetsFor(entry.path).find(containsSystemPath);
      if (e.dataTransfer.dropEffect === "none" && owned) {
        void accessDenied("move", owned);
      }
    },
    onDragOver: entry.kind === "dir" ? dragOver(entry.path) : undefined,
    onDragLeave: () => setDropTarget(null),
    onDrop: entry.kind === "dir" ? dropOn(entry.path) : undefined,
    /* Advertised to the desktop's pointer drag, which cannot see HTML5 events. */
    "data-drop-path": entry.kind === "dir" ? entry.path : undefined,
  });

  const itemProps = (entry: FsEntry) => ({
    type: "button" as const,
    "data-path": entry.path,
    onMouseDown: (e: ReactMouseEvent) => {
      e.stopPropagation();
      selectOn(e, entry.path);
    },
    onDoubleClick: () => openEntry(entry),
    /* A finger opens with one tap; see useMediaQuery for why. */
    onClick: coarse ? () => openEntry(entry) : undefined,
    onContextMenu: itemMenu(entry),
    ...dragProps(entry),
  });

  const stateClasses = (entry: FsEntry, base: string) =>
    [
      base,
      selected.includes(entry.path) ? styles.selected : "",
      /* Shown because the option is on: drawn ghosted, the way XP drew a
       * hidden file you had asked to see. */
      isHiddenEntry(entry) ? styles.ghost : "",
      isDropTarget(entry.path) ? styles.dropTarget : "",
      clipboardMode === "cut" && clipboardPaths.includes(entry.path) ? styles.cut : "",
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
            items: [
              ...(Object.keys(VIEW_LABELS) as ViewMode[]).map((mode) => ({
                label: view === mode ? `• ${VIEW_LABELS[mode]}` : `   ${VIEW_LABELS[mode]}`,
                onClick: () => setView(mode),
              })),
              {
                label: `${showHidden ? "✓" : "   "} Show hidden files and folders`,
                onClick: () => setShowHidden(!showHidden),
              },
            ],
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
            showHidden={showHidden}
            dropTarget={isDropTarget}
            onDragOverDir={dragOver}
            onDropDir={dropOn}
            onDragLeaveDir={() => setDropTarget(null)}
          />
        </div>

        <div
          className={[
            styles.pane,
            styles[view],
            isDropTarget(current) ? styles.dropTarget : "",
          ].join(" ")}
          ref={paneRef}
          onContextMenu={backgroundMenu}
          onPointerDown={beginMarquee}
          onDragOver={dragOver(current)}
          onDragLeave={() => setDropTarget(null)}
          onDrop={dropOn(current)}
          data-drop-path={current}
        >
          {items.length === 0 && <div className={styles.empty}>This folder is empty.</div>}
          {marquee && (
            <div
              className={styles.marquee}
              style={{
                left: Math.min(marquee.x0, marquee.x1),
                top: Math.min(marquee.y0, marquee.y1),
                width: Math.abs(marquee.x1 - marquee.x0),
                height: Math.abs(marquee.y1 - marquee.y0),
              }}
            />
          )}

          {view === "details" ? (
            <>
              <div className={styles.headerRow}>
                <span>Name</span>
                <span>Size</span>
                <span>Type</span>
                <span>Date Modified</span>
              </div>
              {items.map((entry) => (
                <button key={entry.path} {...itemProps(entry)} className={stateClasses(entry, styles.detailRow)}>
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
              <button key={entry.path} {...itemProps(entry)} className={stateClasses(entry, styles.item)}>
                <span className={styles.thumb}>
                  {view === "thumbnails" && isBinary(entry) && entry.mime?.startsWith("image/") ? (
                    <img className={styles.preview} src={entry.thumb ?? blobUrlFor(entry)} alt="" loading="lazy" />
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
          {selected.length === 1 ? ` — ${basename(selected[0])} selected` : ""}
          {selected.length > 1 ? ` — ${selected.length} selected` : ""}
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
  /* The tree takes drops too - every folder in it is a folder. Handlers are
   * the list's own, so a drop means the same thing in both places. */
  dropTarget: (path: string) => boolean;
  onDragOverDir: (path: string) => (e: ReactDragEvent) => void;
  onDropDir: (path: string) => (e: ReactDragEvent) => void;
  onDragLeaveDir: () => void;
  showHidden: boolean;
};

function TreeNode(props: TreeProps) {
  const { path, depth, entries, current, expanded, onToggle, onSelect } = props;
  const children = useMemo(
    () => listEntries(entries, path, props.showHidden ? "attribute" : false).filter((e) => e.kind === "dir"),
    [entries, path, props.showHidden]
  );
  const isOpen = expanded.has(path);
  const label = isDriveRoot(path) ? `Local Disk (${path})` : basename(path);

  return (
    <>
      <div
        className={[
          styles.row,
          path === current ? styles.current : "",
          props.dropTarget(path) ? styles.dropTarget : "",
        ].join(" ")}
        style={{ paddingLeft: depth * 14 }}
        onDragOver={props.onDragOverDir(path)}
        onDragLeave={props.onDragLeaveDir}
        onDrop={props.onDropDir(path)}
        data-drop-path={path}
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
          {/* The list's icon, so My Pictures is My Pictures in the tree too. */}
          {isDriveRoot(path) || !entries[path] ? <DriveIcon size={16} /> : entryIcon(entries[path], 16)}
          {label}
        </button>
      </div>

      {isOpen &&
        children.map((child) => (
          <TreeNode
            {...props}
            key={child.path}
            path={child.path}
            depth={depth + 1}
          />
        ))}
    </>
  );
}
