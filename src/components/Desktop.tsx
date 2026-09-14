import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useWindowStore } from "../store/windowStore";
import { listEntries, useFsStore, type FsEntry } from "../store/fsStore";
import { apps, appIds, type AppId } from "../apps/registry";
import { DesktopIcon } from "./DesktopIcon";
import {
  CELL_H,
  FIELD_PAD,
  defaultPosition,
  snap,
  useDesktopStore,
  type Pos,
} from "../store/desktopStore";
import { useMenuStore } from "../store/menuStore";
import { confirmDialog, errorDialog, promptDialog, propertiesDialog } from "../store/dialogStore";
import { useClipboardStore } from "../store/clipboardStore";
import { pasteInto } from "../fs/clipboard";
import { DESKTOP_DIR } from "../fs/seed";
import { importFiles } from "../fs/import";
import { launchFile } from "../fs/open";
import { dropPathAt, useDndStore } from "../store/dndStore";
import { PATH_MIME } from "../fs/dnd";
import { basename } from "../fs/path";
import { entryIcon } from "../fs/icons";
import styles from "./Desktop.module.css";

const ICON_W = 76;
const ICON_H = 78;

const desktopApps = appIds.filter((id) => apps[id].onDesktop);

type Item =
  | { id: string; kind: "app"; appId: AppId; label: string }
  | { id: string; kind: "file"; entry: FsEntry; label: string };

type Drag = { id: string; offsetX: number; offsetY: number; pos: Pos; moved: boolean };
type Marquee = { x0: number; y0: number; x1: number; y1: number };

const normaliseRect = (m: Marquee) => ({
  left: Math.min(m.x0, m.x1),
  top: Math.min(m.y0, m.y1),
  width: Math.abs(m.x1 - m.x0),
  height: Math.abs(m.y1 - m.y0),
});

function AppGlyph({ appId }: { appId: AppId }) {
  const Icon = apps[appId].icon;
  return <Icon size={32} />;
}

export function Desktop() {
  const open = useWindowStore((s) => s.open);
  const entries = useFsStore((s) => s.entries);
  const move = useFsStore((s) => s.move);
  const remove = useFsStore((s) => s.remove);
  const rename = useFsStore((s) => s.rename);
  const uniquePath = useFsStore((s) => s.uniquePath);
  const positions = useDesktopStore((s) => s.positions);
  const selection = useDesktopStore((s) => s.selection);
  const select = useDesktopStore((s) => s.select);
  const setPosition = useDesktopStore((s) => s.setPosition);
  const resetPositions = useDesktopStore((s) => s.resetPositions);
  const openMenu = useMenuStore((s) => s.open);
  const setHoverPath = useDndStore((s) => s.setHoverPath);
  const clipboardPath = useClipboardStore((s) => s.path);
  const cutToClipboard = useClipboardStore((s) => s.cut);
  const copyToClipboard = useClipboardStore((s) => s.copy);

  const fieldRef = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState(8);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const [dropActive, setDropActive] = useState(false);

  useLayoutEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    const update = () =>
      setRows(Math.max(1, Math.floor((el.clientHeight - FIELD_PAD) / CELL_H)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /* The desktop is an application launcher *and* a folder. The shortcuts come
   * from the registry, the rest is whatever is in C:\...\Desktop - which is what
   * makes dragging a file onto the desktop mean something.
   */
  const items = useMemo<Item[]>(() => {
    const shortcuts: Item[] = desktopApps.map((appId) => ({
      id: appId,
      kind: "app",
      appId,
      label: apps[appId].label,
    }));
    const files: Item[] = listEntries(entries, DESKTOP_DIR).map((entry) => ({
      /* Keyed by path, and shortcuts are keyed by appId. They cannot collide:
       * every path starts with "C:/". */
      id: entry.path,
      kind: "file",
      entry,
      label: basename(entry.path),
    }));
    return [...shortcuts, ...files];
  }, [entries]);

  const layout = useMemo(() => {
    const map: Record<string, Pos> = {};
    items.forEach((item, index) => {
      map[item.id] = positions[item.id] ?? defaultPosition(index, rows);
    });
    return map;
  }, [items, positions, rows]);

  const dragRef = useRef<Drag | null>(null);
  const marqueeRef = useRef<Marquee | null>(null);
  const layoutRef = useRef(layout);
  const itemsRef = useRef(items);
  useEffect(() => {
    layoutRef.current = layout;
    itemsRef.current = items;
  }, [layout, items]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const rect = fieldRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const d = dragRef.current;
      if (d) {
        d.pos = { x: x - d.offsetX, y: y - d.offsetY };
        d.moved = true;
        setDrag({ ...d });
        /* Ask the document whether something under the cursor is advertising
         * itself as a folder. The desktop field advertises nothing, so this is
         * null for the whole time the drag stays at home - no separate "am I
         * still inside" test is needed.
         *
         * Only a file can land somewhere else: an application shortcut has no
         * path to move, and its id is an app id rather than one starting "C:".
         */
        setHoverPath(d.id.startsWith("C:") ? dropPathAt(e.clientX, e.clientY) : null);
        return;
      }

      const m = marqueeRef.current;
      if (m) {
        m.x1 = x;
        m.y1 = y;
        setMarquee({ ...m });

        const box = normaliseRect(m);
        select(
          itemsRef.current
            .filter((item) => {
              const p = layoutRef.current[item.id];
              return (
                p &&
                p.x < box.left + box.width &&
                p.x + ICON_W > box.left &&
                p.y < box.top + box.height &&
                p.y + ICON_H > box.top
              );
            })
            .map((item) => item.id)
        );
      }
    };

    const onUp = () => {
      const d = dragRef.current;
      if (d) {
        const target = useDndStore.getState().hoverPath;
        if (d.moved && target) {
          /* Dropped into a folder somewhere else on screen. The icon's stored
           * position is deliberately not updated - it is leaving. */
          if (useFsStore.getState().move(d.id, target) === null) {
            void errorDialog(
              "Move",
              `Cannot move '${basename(d.id)}' there: something with that name already exists.`
            );
          }
        } else if (d.moved) {
          setPosition(d.id, snap(d.pos));
        }
        dragRef.current = null;
        setDrag(null);
        setHoverPath(null);
      }
      if (marqueeRef.current) {
        marqueeRef.current = null;
        setMarquee(null);
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [select, setPosition, setHoverPath]);

  const launch = (appId: AppId) =>
    open(appId, { title: apps[appId].title, bounds: apps[appId].defaultSize });

  const openItem = (item: Item) => {
    if (item.kind === "app") {
      launch(item.appId);
      return;
    }
    if (item.entry.kind === "dir") {
      open("explorer", {
        title: item.label,
        bounds: { width: 660, height: 460 },
        props: { path: item.entry.path },
      });
      return;
    }
    launchFile(item.entry);
  };

  const beginDrag = (id: string) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const rect = fieldRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pos = layout[id];
    dragRef.current = {
      id,
      offsetX: e.clientX - rect.left - pos.x,
      offsetY: e.clientY - rect.top - pos.y,
      pos,
      moved: false,
    };
    setDrag(dragRef.current);
    select([id]);
  };

  const beginMarquee = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const rect = fieldRef.current?.getBoundingClientRect();
    if (!rect) return;
    const start = {
      x0: e.clientX - rect.left,
      y0: e.clientY - rect.top,
      x1: e.clientX - rect.left,
      y1: e.clientY - rect.top,
    };
    marqueeRef.current = start;
    setMarquee(start);
    select([]);
  };

  const arrangeByName = () => {
    [...items]
      .sort((a, b) => a.label.localeCompare(b.label))
      .forEach((item, index) => setPosition(item.id, defaultPosition(index, rows)));
  };

  const newFolderHere = async () => {
    const suggested = uniquePath(DESKTOP_DIR, "New Folder");
    const name = await promptDialog("New Folder", "Name the new folder:", basename(suggested));
    if (name === null) return;
    useFsStore.getState().mkdir(uniquePath(DESKTOP_DIR, name.trim()));
  };

  const desktopMenu = (e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    select([]);
    openMenu(e.clientX, e.clientY, [
      {
        kind: "item",
        label: "Arrange Icons By",
        submenu: [
          { kind: "item", label: "Name", onClick: arrangeByName },
          { kind: "item", label: "Auto Arrange", onClick: resetPositions },
        ],
      },
      { kind: "item", label: "Refresh", onClick: () => select([]) },
      { kind: "separator" },
      {
        kind: "item",
        label: "Paste",
        disabled: clipboardPath === null,
        onClick: () => pasteInto(DESKTOP_DIR),
      },
      { kind: "separator" },
      {
        kind: "item",
        label: "New",
        submenu: [{ kind: "item", label: "Folder", onClick: () => void newFolderHere() }],
      },
      { kind: "separator" },
      {
        kind: "item",
        label: "Properties",
        onClick: () => void propertiesDialog(DESKTOP_DIR, "Desktop"),
      },
    ]);
  };

  const itemMenu = (item: Item) => (e: ReactMouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    select([item.id]);

    if (item.kind === "app") {
      openMenu(e.clientX, e.clientY, [
        { kind: "item", label: "Open", bold: true, onClick: () => openItem(item) },
        { kind: "separator" },
        { kind: "item", label: "Delete", disabled: true },
        { kind: "item", label: "Rename", disabled: true },
        { kind: "separator" },
        { kind: "item", label: "Properties", disabled: true },
      ]);
      return;
    }

    openMenu(e.clientX, e.clientY, [
      { kind: "item", label: "Open", bold: true, onClick: () => openItem(item) },
      { kind: "separator" },
      { kind: "item", label: "Cut", onClick: () => cutToClipboard(item.entry.path) },
      { kind: "item", label: "Copy", onClick: () => copyToClipboard(item.entry.path) },
      {
        kind: "item",
        label: "Paste",
        disabled: clipboardPath === null || item.entry.kind !== "dir",
        onClick: () => pasteInto(item.entry.path),
      },
      { kind: "separator" },
      {
        kind: "item",
        label: "Rename",
        onClick: () => {
          void (async () => {
            const next = await promptDialog("Rename", "New name:", item.label);
            if (next === null) return;
            if (rename(item.entry.path, next) === null) {
              void errorDialog("Rename", "That name is already taken, or is not a legal name.");
            }
          })();
        },
      },
      {
        kind: "item",
        label: "Delete",
        onClick: () => {
          void (async () => {
            const ok = await confirmDialog(
              "Confirm Delete",
              `Are you sure you want to delete '${item.label}'?`
            );
            if (ok) remove(item.entry.path);
          })();
        },
      },
      { kind: "separator" },
      {
        kind: "item",
        label: "Properties",
        onClick: () => void propertiesDialog(item.entry.path, item.label),
      },
    ]);
  };

  /* ---- Dropping ----------------------------------------------------------
   * Two kinds arrive here. An internal drag from Explorer carries a path and
   * means "move this onto the desktop". A drag from the host operating system
   * carries real File objects and means "import this".
   */
  const onDragOver = (e: ReactDragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes(PATH_MIME) && !e.dataTransfer.types.includes("Files")) {
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropActive(true);
  };

  const onDrop = (e: ReactDragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDropActive(false);

    const internal = e.dataTransfer.getData(PATH_MIME);
    if (internal) {
      if (move(internal, DESKTOP_DIR) === null) {
        void errorDialog(
          "Move",
          `Cannot move '${basename(internal)}' to the desktop: something with that name is already there.`
        );
      }
      return;
    }

    if (e.dataTransfer.files.length === 0) return;
    void importFiles(e.dataTransfer.files, DESKTOP_DIR).then((error) => {
      if (error) void errorDialog("Copy", error);
    });
  };

  return (
    <div className="desktop">
      <div
        ref={fieldRef}
        className={dropActive ? `${styles.field} ${styles.dropActive}` : styles.field}
        onPointerDown={beginMarquee}
        onContextMenu={desktopMenu}
        onDragOver={onDragOver}
        onDragLeave={() => setDropActive(false)}
        onDrop={onDrop}
      >
        {items.map((item) => {
          const isDragging = drag?.id === item.id;
          const pos = isDragging ? drag.pos : layout[item.id];
          return (
            <DesktopIcon
              key={item.id}
              label={item.label}
              /* Branching on `kind` rather than on a hoisted icon component:
                 TypeScript narrows the union here, and cannot narrow it through
                 a variable assigned above the JSX. */
              icon={item.kind === "app" ? <AppGlyph appId={item.appId} /> : entryIcon(item.entry, 32)}
              selected={selection.includes(item.id)}
              x={pos.x}
              y={pos.y}
              dragging={isDragging}
              onPointerDown={beginDrag(item.id)}
              onContextMenu={itemMenu(item)}
              onOpen={() => openItem(item)}
            />
          );
        })}

        {marquee && <div className={styles.marquee} style={normaliseRect(marquee)} />}
      </div>
    </div>
  );
}
