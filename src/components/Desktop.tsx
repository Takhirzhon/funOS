import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useWindowStore } from "../store/windowStore";
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
import styles from "./Desktop.module.css";

/* The hit box of one icon: narrower than a grid cell, because the gap between
 * cells should not select anything.
 */
const ICON_W = 76;
const ICON_H = 78;

const desktopApps = appIds.filter((id) => apps[id].onDesktop);

type Drag = { id: AppId; offsetX: number; offsetY: number; pos: Pos; moved: boolean };
type Marquee = { x0: number; y0: number; x1: number; y1: number };

const normalise = (m: Marquee) => ({
  left: Math.min(m.x0, m.x1),
  top: Math.min(m.y0, m.y1),
  width: Math.abs(m.x1 - m.x0),
  height: Math.abs(m.y1 - m.y0),
});

export function Desktop() {
  const open = useWindowStore((s) => s.open);
  const positions = useDesktopStore((s) => s.positions);
  const selection = useDesktopStore((s) => s.selection);
  const select = useDesktopStore((s) => s.select);
  const setPosition = useDesktopStore((s) => s.setPosition);

  const fieldRef = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState(8);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [marquee, setMarquee] = useState<Marquee | null>(null);

  /* How many icons fit in a column before the next one starts. Measured rather
   * than assumed, so the auto-arranged layout reflows when the browser window
   * is resized instead of running on under the taskbar.
   */
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

  const layout = useMemo(() => {
    const map = {} as Record<AppId, Pos>;
    desktopApps.forEach((id, index) => {
      map[id] = positions[id] ?? defaultPosition(index, rows);
    });
    return map;
  }, [positions, rows]);

  /* The pointer handlers live on `window`, not on the field: a drag that leaves
   * the element - out over a window, or off the edge of the screen - still has
   * to finish, and a listener on the field stops hearing about it.
   *
   * They read from refs rather than from state because the effect is mounted
   * once. Re-subscribing on every pointermove would be a listener churn of
   * sixty pairs a second, and closing over `layout` would capture a stale copy.
   */
  const dragRef = useRef<Drag | null>(null);
  const marqueeRef = useRef<Marquee | null>(null);
  const layoutRef = useRef(layout);
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

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
        return;
      }

      const m = marqueeRef.current;
      if (m) {
        m.x1 = x;
        m.y1 = y;
        setMarquee({ ...m });

        const box = normalise(m);
        const hit = desktopApps.filter((id) => {
          const p = layoutRef.current[id];
          return (
            p.x < box.left + box.width &&
            p.x + ICON_W > box.left &&
            p.y < box.top + box.height &&
            p.y + ICON_H > box.top
          );
        });
        select(hit);
      }
    };

    const onUp = () => {
      const d = dragRef.current;
      if (d) {
        /* Only commit if the pointer actually moved. Without this, every click
         * on an icon writes a position to localStorage and a plain click could
         * nudge an icon by a pixel of jitter.
         */
        if (d.moved) setPosition(d.id, snap(d.pos));
        dragRef.current = null;
        setDrag(null);
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
  }, [select, setPosition]);

  const beginDrag = (id: AppId) => (e: ReactPointerEvent<HTMLButtonElement>) => {
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

  return (
    <div className="desktop">
      <div ref={fieldRef} className={styles.field} onPointerDown={beginMarquee}>
        {desktopApps.map((id) => {
          const app = apps[id];
          const Icon = app.icon;
          const isDragging = drag?.id === id;
          const pos = isDragging ? drag.pos : layout[id];
          return (
            <DesktopIcon
              key={id}
              label={app.label}
              icon={<Icon size={32} />}
              selected={selection.includes(id)}
              x={pos.x}
              y={pos.y}
              dragging={isDragging}
              onPointerDown={beginDrag(id)}
              onOpen={() => open(id, { title: app.title, bounds: app.defaultSize })}
            />
          );
        })}

        {marquee && <div className={styles.marquee} style={normalise(marquee)} />}
      </div>
    </div>
  );
}
