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
import { isHiddenEntry, listEntries, useFsStore, type FsEntry } from "../store/fsStore";
import { useFolderOptions } from "../store/folderOptions";
import { useThemeStore } from "../store/themeStore";
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
import { getDragPaths, isPathDrag } from "../fs/dnd";
import { moveInto } from "../fs/move";
import { basename } from "../fs/path";
import { entryIcon } from "../fs/icons";
import { CV_PATH, urlForPath } from "../apps/ie/site";
import { useWallpaperStyle } from "../store/wallpaper";
import styles from "./Desktop.module.css";

const ICON_W = 76;
const ICON_H = 78;

const desktopApps = appIds.filter((id) => apps[id].onDesktop);

type Item =
  | { id: string; kind: "app"; appId: AppId; label: string }
  | { id: string; kind: "file"; entry: FsEntry; label: string };

/* One gesture, possibly many icons. `id` is the one under the pointer and
 * `pos` is where it is; `ids` is everything that moves with it - the
 * selection, when the gesture started on a member of it. The others follow
 * at the offset they had from the anchor when the drag began. */
type Drag = { id: string; ids: string[]; offsetX: number; offsetY: number; pos: Pos; moved: boolean };
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
  const showHidden = useFolderOptions((s) => s.showHidden);
  const wallpaper = useWallpaperStyle();
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

  /* A deep link. /projects, /blog/x or /cv in the address bar - from a cover
   * letter, the feed, a search result - opens what the path names once the
   * desktop is up: Internet Explorer on the page, or the CV in its reader.
   * The path is consumed here; Internet Explorer puts its own back while it
   * is open and clears it when it closes, so a reload reopens what was on
   * screen and nothing else. The CV is a file, and files arrive with the file
   * system, so this waits for it. #about:x is the form the first feed items
   * went out with, and still arrives. */
  const fsReady = useFsStore((s) => s.ready);
  useEffect(() => {
    if (!fsReady) return;
    const { pathname, hash } = window.location;
    const path = pathname.replace(/\/+$/, "").toLowerCase() || "/";
    const url = hash.startsWith("#about:") ? hash.slice(1) : path === "/" ? undefined : urlForPath(path);
    if (!url && path !== CV_PATH) return;
    window.history.replaceState(null, "", "/");
    if (url) {
      open("internetExplorer", {
        title: apps.internetExplorer.title,
        bounds: apps.internetExplorer.defaultSize,
        props: { url },
      });
      return;
    }
    const cv = listEntries(useFsStore.getState().entries, DESKTOP_DIR).find((e) => e.mime === "application/pdf");
    if (cv) launchFile(cv);
  }, [fsReady, open]);

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
    const files: Item[] = listEntries(entries, DESKTOP_DIR, showHidden ? "attribute" : false).map((entry) => ({
      /* Keyed by path, and shortcuts are keyed by appId. They cannot collide:
       * every path starts with "C:/". */
      id: entry.path,
      kind: "file",
      entry,
      label: basename(entry.path),
    }));
    return [...shortcuts, ...files];
  }, [entries, showHidden]);

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
        setHoverPath(d.ids.some((id) => id.startsWith("C:")) ? dropPathAt(e.clientX, e.clientY) : null);
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
        if (d.moved && target) {
          /* Dropped into a folder somewhere else on screen - or the bin. The
           * files go; the shortcuts in the same selection stay where they
           * were. Stored positions are deliberately not updated: the files
           * are leaving, and the shortcuts did not move. */
          moveInto(d.ids.filter((id) => id.startsWith("C:")), target);
        } else if (d.moved) {
          /* Every icon in the gesture moves by the same amount and snaps on
           * its own. */
          const anchor = layoutRef.current[d.id];
          const dx = d.pos.x - anchor.x;
          const dy = d.pos.y - anchor.y;
          for (const id of d.ids) {
            const from = layoutRef.current[id];
            if (from) setPosition(id, snap({ x: from.x + dx, y: from.y + dy }));
          }
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
    /* Ctrl adds to the selection; anything else starts a new one. Dragging a
     * member of a multiple selection must not collapse it to one icon - and
     * it drags the whole selection. */
    let next: string[];
    if (e.ctrlKey) {
      next = selection.includes(id) ? selection.filter((s) => s !== id) : [...selection, id];
    } else if (selection.includes(id)) {
      next = selection;
    } else {
      next = [id];
    }
    select(next);
    dragRef.current = {
      id,
      ids: next.includes(id) ? next : [id],
      offsetX: e.clientX - rect.left - pos.x,
      offsetY: e.clientY - rect.top - pos.y,
      pos,
      moved: false,
    };
    setDrag(dragRef.current);
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
      ...(item.entry.mime?.startsWith("image/")
        ? [
            { kind: "separator" as const },
            {
              kind: "item" as const,
              label: "Set as Desktop Background",
              onClick: () => useThemeStore.getState().setWallpaper(item.entry.path as `C:${string}`),
            },
          ]
        : []),
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
    if (!isPathDrag(e.dataTransfer) && !e.dataTransfer.types.includes("Files")) {
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropActive(true);
  };

  const onDrop = (e: ReactDragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDropActive(false);

    const internal = getDragPaths(e.dataTransfer);
    if (internal.length) {
      moveInto(internal, DESKTOP_DIR);
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
    if (!isPathDrag(e.dataTransfer)) return;
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
    moveInto(getDragPaths(e.dataTransfer), RECYCLE_BIN);
  };

  return (
    <div className="desktop" style={wallpaper}>
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
          const isDragging = drag !== null && drag.moved && drag.ids.includes(item.id);
          const pos =
            isDragging && drag
              ? {
                  x: layout[item.id].x + (drag.pos.x - layout[drag.id].x),
                  y: layout[item.id].y + (drag.pos.y - layout[drag.id].y),
                }
              : layout[item.id];
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
              ghost={item.kind === "file" && isHiddenEntry(item.entry)}
              onPointerDown={beginDrag(item.id)}
              onContextMenu={itemMenu(item)}
              onOpen={() => openItem(item)}
              dropPath={item.kind === "app" && item.appId === "recycleBin" ? RECYCLE_BIN : undefined}
              dropTarget={
                item.kind === "app" &&
                item.appId === "recycleBin" &&
                (binHover || (hoverPath === RECYCLE_BIN && !drag?.ids.includes(item.id)))
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
