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
  CELL_W,
  FIELD_PAD,
  defaultPosition,
  snap,
  useDesktopStore,
  type Pos,
} from "../store/desktopStore";
import { useMenuStore } from "../store/menuStore";
import { errorDialog, promptDialog, propertiesDialog } from "../store/dialogStore";
import { useClipboardStore } from "../store/clipboardStore";
import { pasteInto } from "../fs/clipboard";
import { showBalloon } from "../store/balloonStore";
import { deletePaths } from "../fs/trash";
import { useShellShortcuts } from "../hooks/useShellShortcuts";
import { COARSE, useMediaQuery } from "../hooks/useMediaQuery";
import { DESKTOP_DIR, RECYCLE_BIN } from "../fs/seed";
import { importFiles } from "../fs/import";
import { launchFile } from "../fs/open";
import { accessDenied, containsSystemPath } from "../fs/system";
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
  const blurWindows = useWindowStore((s) => s.blur);
  const focusedWindow = useWindowStore((s) => s.focusedId);
  const entries = useFsStore((s) => s.entries);
  const move = useFsStore((s) => s.move);
  const rename = useFsStore((s) => s.rename);
  const uniquePath = useFsStore((s) => s.uniquePath);
  const positions = useDesktopStore((s) => s.positions);
  const selection = useDesktopStore((s) => s.selection);
  const select = useDesktopStore((s) => s.select);
  const setPosition = useDesktopStore((s) => s.setPosition);
  const resetPositions = useDesktopStore((s) => s.resetPositions);
  const openMenu = useMenuStore((s) => s.open);
  const setHoverPath = useDndStore((s) => s.setHoverPath);
  const clipboardPaths = useClipboardStore((s) => s.paths);
  const clipboardMode = useClipboardStore((s) => s.mode);
  const cutToClipboard = useClipboardStore((s) => s.cut);
  const copyToClipboard = useClipboardStore((s) => s.copy);

  const fieldRef = useRef<HTMLDivElement>(null);
  const coarse = useMediaQuery(COARSE);
  const [grid, setGrid] = useState({ rows: 8, width: 0, height: 0 });
  const rows = grid.rows;
  const [drag, setDrag] = useState<Drag | null>(null);
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const [dropActive, setDropActive] = useState(false);
  /* Explorer's HTML5 drag hovering the Recycle Bin icon. The pointer drag
   * reports the same thing through the dnd store's hoverPath. */
  const [binHover, setBinHover] = useState(false);
  const hoverPath = useDndStore((s) => s.hoverPath);

  /* The welcome balloon, once per log-in. XP popped one out of the tray a few
   * seconds after the desktop appeared, and the delay is the whole effect: it
   * arrives after you have started looking around, not on top of the first
   * frame. */
  useEffect(() => {
    const timer = setTimeout(() => {
      showBalloon(
        "Welcome to funOS",
        "Right-click the desktop, try Start > All Programs, and drop a file from your real computer onto this one.",
        "info"
      );
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  useLayoutEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    const update = () =>
      setGrid({
        rows: Math.max(1, Math.floor((el.clientHeight - FIELD_PAD) / CELL_H)),
        width: el.clientWidth,
        height: el.clientHeight,
      });
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

  /* Where each icon goes.
   *
   * A stored position is honoured if it is on screen. Everything else - a new
   * shortcut, a file that just arrived, an icon whose stored spot is off the
   * bottom of a phone that has fewer rows than the monitor it was placed on -
   * takes the first free cell, walking down column one and then over. Which
   * is what Windows does, and the reason two icons never share a cell there.
   *
   * It used to be "stored position, else the cell for this index", and the
   * index knew nothing about what was stored: adding Internet Explorer at the
   * top of the registry put it on top of My Computer for anyone who had ever
   * dragged an icon. */
  const layout = useMemo(() => {
    const map: Record<string, Pos> = {};
    const taken = new Set<string>();
    const key = (p: Pos) => `${p.x},${p.y}`;
    const onScreen = (p: Pos) =>
      grid.width === 0 || (p.x + CELL_W <= grid.width && p.y + CELL_H <= grid.height);

    const loose: Item[] = [];
    for (const item of items) {
      const stored = positions[item.id];
      if (stored && onScreen(stored) && !taken.has(key(stored))) {
        map[item.id] = stored;
        taken.add(key(stored));
      } else {
        loose.push(item);
      }
    }

    let slot = 0;
    for (const item of loose) {
      let pos = defaultPosition(slot, rows);
      while (taken.has(key(pos))) pos = defaultPosition(++slot, rows);
      map[item.id] = pos;
      taken.add(key(pos));
      slot += 1;
    }
    return map;
  }, [items, positions, rows, grid.width, grid.height]);

  const dragRef = useRef<Drag | null>(null);
  /* Whether the gesture that just ended moved the icon. The click event
   * arrives after pointerup, by which time the drag record is gone, and a
   * tap that dragged an icon somewhere must not also open it. */
  const lastMoved = useRef(false);
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
      lastMoved.current = d?.moved ?? false;
      if (d) {
        const target = useDndStore.getState().hoverPath;
        if (d.moved && target && containsSystemPath(d.id)) {
          /* It stays; Windows still lets you drag it before saying so. */
          void accessDenied("move", d.id);
        } else if (d.moved && target === RECYCLE_BIN) {
          /* Onto the bin. Recycled rather than moved, so Restore knows where
           * it came from. */
          if (useFsStore.getState().recycle(d.id) === null) {
            void errorDialog("Recycle Bin", `Cannot send '${basename(d.id)}' to the Recycle Bin.`);
          }
        } else if (d.moved && target) {
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

  /* The desktop owns the clipboard keys whenever no window is focused, which
   * is exactly the state clicking it produces. */
  /* Only the file part of the selection: an application shortcut has no path,
   * so Cut, Copy and Delete have nothing to act on for it. */
  const selectedFiles = selection.filter((id) => id.startsWith("C:"));
  useShellShortcuts({
    active: focusedWindow === null,
    selected: selectedFiles,
    folder: DESKTOP_DIR,
    onDeleted: (paths) => select(selection.filter((id) => !paths.includes(id))),
  });

  const targetsFor = (path: string) =>
    selection.includes(path) ? selection.filter((id) => id.startsWith("C:")) : [path];

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
    blurWindows();
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
    /* Ctrl adds to the selection; anything else starts a new one. Dragging a
     * member of a multiple selection must not collapse it to one icon. */
    if (e.ctrlKey) {
      select(selection.includes(id) ? selection.filter((s) => s !== id) : [...selection, id]);
    } else if (!selection.includes(id)) {
      select([id]);
    }
  };

  const beginMarquee = (e: ReactPointerEvent<HTMLDivElement>) => {
    blurWindows();
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
        disabled: clipboardPaths.length === 0,
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
        /* Display Properties, not the Desktop folder's properties. Right-click
         * the desktop and choose Properties and this is what opens in Windows,
         * which is why nobody ever found the folder's own dialog. */
        label: "Properties",
        onClick: () =>
          open("displayProperties", {
            title: "Display Properties",
            bounds: { width: 420, height: 470 },
          }),
      },
    ]);
  };

  const itemMenu = (item: Item) => (e: ReactMouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selection.includes(item.id)) select([item.id]);

    if (item.kind === "app") {
      openMenu(e.clientX, e.clientY, [
        { kind: "item", label: "Open", bold: true, onClick: () => openItem(item) },
        { kind: "separator" },
        { kind: "item", label: "Delete", disabled: true },
        { kind: "item", label: "Rename", disabled: true },
        { kind: "separator" },
        {
          kind: "item",
          label: "Properties",
          /* My Computer's properties are the system's - the one Properties
           * on the desktop that opened something people went looking for. */
          disabled: item.appId !== "myComputer",
          onClick: () => launch("systemProperties"),
        },
      ]);
      return;
    }

    openMenu(e.clientX, e.clientY, [
      { kind: "item", label: "Open", bold: true, onClick: () => openItem(item) },
      { kind: "separator" },
      { kind: "item", label: "Cut", onClick: () => cutToClipboard(targetsFor(item.entry.path)) },
      { kind: "item", label: "Copy", onClick: () => copyToClipboard(targetsFor(item.entry.path)) },
      {
        kind: "item",
        label: "Paste",
        disabled: clipboardPaths.length === 0 || item.entry.kind !== "dir",
        onClick: () => pasteInto(item.entry.path),
      },
      { kind: "separator" },
      {
        kind: "item",
        label: "Rename",
        onClick: () => {
          void (async () => {
            if (containsSystemPath(item.entry.path)) {
              await accessDenied("rename", item.entry.path);
              return;
            }
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
        onClick: () => void deletePaths(targetsFor(item.entry.path)),
      },
      { kind: "separator" },
      {
        kind: "item",
        label: "Properties",
        onClick: () => void propertiesDialog(targetsFor(item.entry.path), item.label),
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
      if (containsSystemPath(internal)) {
        void accessDenied("move", internal);
      } else if (move(internal, DESKTOP_DIR) === null) {
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

  /* Dropping a file from Explorer onto the Recycle Bin icon. Stops before
   * the field's own handler, which would move the file onto the desktop. */
  const binDragOver = (e: ReactDragEvent<HTMLButtonElement>) => {
    if (!e.dataTransfer.types.includes(PATH_MIME)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setBinHover(true);
  };
  const binDrop = (e: ReactDragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setBinHover(false);
    setDropActive(false);
    const source = e.dataTransfer.getData(PATH_MIME);
    if (!source) return;
    if (containsSystemPath(source)) {
      void accessDenied("delete", source);
    } else if (useFsStore.getState().recycle(source) === null) {
      void errorDialog("Recycle Bin", `Cannot send '${basename(source)}' to the Recycle Bin.`);
    }
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
          /* Only once the pointer has actually moved. The drag record exists
           * from pointerdown, but the dragging style makes the icon transparent
           * to hit-testing - applied on the first press, the button under the
           * cursor vanishes before pointerup, the click lands on the field, and
           * no double-click ever reaches the icon. */
          const isDragging = drag?.id === item.id && drag.moved;
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
              cut={clipboardMode === "cut" && clipboardPaths.includes(item.id)}
              onPointerDown={beginDrag(item.id)}
              onContextMenu={itemMenu(item)}
              onOpen={() => openItem(item)}
              dropPath={item.kind === "app" && item.appId === "recycleBin" ? RECYCLE_BIN : undefined}
              dropTarget={
                item.kind === "app" &&
                item.appId === "recycleBin" &&
                (binHover || (hoverPath === RECYCLE_BIN && drag?.id !== item.id))
              }
              onDragOver={item.kind === "app" && item.appId === "recycleBin" ? binDragOver : undefined}
              onDragLeave={item.kind === "app" && item.appId === "recycleBin" ? () => setBinHover(false) : undefined}
              onDrop={item.kind === "app" && item.appId === "recycleBin" ? binDrop : undefined}
              onTap={
                coarse
                  ? () => {
                      if (!lastMoved.current) openItem(item);
                    }
                  : undefined
              }
            />
          );
        })}

        {marquee && <div className={styles.marquee} style={normaliseRect(marquee)} />}
      </div>
    </div>
  );
}
