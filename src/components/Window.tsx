import { Suspense, useEffect } from "react";
import { Rnd } from "react-rnd";
import { TASKBAR_HEIGHT, useWindowStore, type WindowState } from "../store/windowStore";
import { useMenuStore } from "../store/menuStore";
import { windowSystemMenu } from "./windowSystemMenu";
import { apps, type AppDef } from "../apps/registry";
import styles from "./Window.module.css";

type Props = { window: WindowState };

/* The Suspense fallback, and the hourglass that goes with it. XP showed the
 * arrow-with-hourglass from the double-click until the program's window had
 * something in it, and the class on <body> is how a cursor is changed for the
 * whole screen rather than for the one element under it. Counted, because two
 * programs can be starting at once. */
let starting = 0;
function Starting() {
  useEffect(() => {
    starting += 1;
    document.body.classList.add("app-starting");
    return () => {
      starting -= 1;
      if (starting === 0) document.body.classList.remove("app-starting");
    };
  }, []);
  return <div className={styles.loading} />;
}

const MIN_W = 240;
const MIN_H = 160;

/* How close to an edge a window has to be dropped before it lines up with it.
 * Applied on drop rather than continuously during the drag: a window that jumps
 * while you are still holding it feels like it is fighting you, and XP never
 * did that. Twelve pixels is close enough to be deliberate and far enough to
 * hit without aiming.
 */
const SNAP = 12;

function snapToEdges(x: number, y: number, width: number, height: number) {
  const right = document.documentElement.clientWidth;
  const bottom = document.documentElement.clientHeight - TASKBAR_HEIGHT;

  let nextX = x;
  if (Math.abs(x) <= SNAP) nextX = 0;
  else if (Math.abs(x + width - right) <= SNAP) nextX = right - width;

  let nextY = y;
  if (Math.abs(y) <= SNAP) nextY = 0;
  else if (Math.abs(y + height - bottom) <= SNAP) nextY = bottom - height;

  return { x: nextX, y: nextY };
}

export function Window({ window: w }: Props) {
  const focus = useWindowStore((s) => s.focus);
  const close = useWindowStore((s) => s.close);
  const setBounds = useWindowStore((s) => s.setBounds);
  const toggleMaximize = useWindowStore((s) => s.toggleMaximize);
  const minimize = useWindowStore((s) => s.minimize);
  const focusedId = useWindowStore((s) => s.focusedId);
  const openMenu = useMenuStore((s) => s.open);

  const app = apps[w.appId as keyof typeof apps] as AppDef | undefined;
  if (!app) return null;
  const Body = app.component;

  const isFocused = focusedId === w.id;

  /* A minimized window stays mounted. Unmounting it is why minimize used to
   * teleport - there is nothing left to animate on the frame the flag flips -
   * and it also threw away whatever state the app was holding, which is not
   * what minimize means anywhere else.
   *
   * No timers and no phase state: swapping the animation-name between these two
   * classes is itself what starts the animation, so restoring replays the open
   * animation for free. The minimize animation fills forwards, which is what
   * keeps the window invisible afterwards.
   */
  const animClass = w.minimized ? styles.minimizing : styles.opening;

  return (
    <Rnd
      size={{ width: w.bounds.width, height: w.bounds.height }}
      position={{ x: w.bounds.x, y: w.bounds.y }}
      minWidth={app?.minSize?.width ?? MIN_W}
      minHeight={app?.minSize?.height ?? MIN_H}
      bounds="parent"
      dragHandleClassName="title-bar"
      cancel=".title-bar-controls,.title-bar-controls *"
      disableDragging={w.maximized}
      enableResizing={!w.maximized}
      onDragStart={() => focus(w.id)}
      onMouseDown={() => focus(w.id)}
      onDragStop={(_, d) => setBounds(w.id, snapToEdges(d.x, d.y, w.bounds.width, w.bounds.height))}
      onResizeStop={(_, __, ref, ___, position) => {
        setBounds(w.id, {
          width: parseInt(ref.style.width, 10),
          height: parseInt(ref.style.height, 10),
          x: position.x,
          y: position.y,
        });
      }}
      /* A minimized window is invisible but still in the layout, so it has to
       * stop answering the mouse or it swallows clicks on the desktop under it. */
      style={{ zIndex: w.zIndex, pointerEvents: w.minimized ? "none" : undefined }}
      className={[
        styles.shadowWrap,
        isFocused ? styles.focused : styles.blurred,
        w.minimized ? styles.hidden : "",
      ].join(" ")}
    >
      {/* Minimized windows stay in the DOM, so they also have to leave the tab
          order and the accessibility tree - otherwise Tab walks through the
          controls of windows nobody can see. */}
      <div className={`window ${styles.frame} ${animClass}`} inert={w.minimized}>
        <div
          className={`title-bar ${styles.titleBar}`}
          onDoubleClick={() => toggleMaximize(w.id)}
          onContextMenu={(e) => {
            e.preventDefault();
            openMenu(e.clientX, e.clientY, windowSystemMenu(w));
          }}
        >
          <div className="title-bar-text">{w.title}</div>
          <div className="title-bar-controls">
            <button
              aria-label="Minimize"
              onClick={(e) => {
                e.stopPropagation();
                minimize(w.id);
              }}
            />
            <button
              aria-label={w.maximized ? "Restore" : "Maximize"}
              onClick={(e) => {
                e.stopPropagation();
                toggleMaximize(w.id);
              }}
            />
            <button
              aria-label="Close"
              onClick={(e) => {
                e.stopPropagation();
                close(w.id);
              }}
            />
          </div>
        </div>
        <div className={`window-body ${styles.body}`}>
          {/* Every app is a lazy import, so opening one can take a moment on a
              cold cache. The fallback is deliberately the empty window rather
              than a spinner: the frame, the caption and the task button are
              already there, which is what "the program is starting" looks
              like on a desktop. A spinner inside a window that already exists
              reads as an error. */}
          <Suspense fallback={<Starting />}>
            {/* windowId lets an app talk about its own window - Notepad renames
                the caption to whatever file it has open. */}
            <Body {...(w.props ?? {})} windowId={w.id} />
          </Suspense>
        </div>
      </div>
    </Rnd>
  );
}
