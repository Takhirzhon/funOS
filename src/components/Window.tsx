import { Rnd } from "react-rnd";
import { useWindowStore, type WindowState } from "../store/windowStore";
import { apps } from "../apps/registry";

type Props = { window: WindowState };

const MIN_W = 240;
const MIN_H = 160;

export function Window({ window: w }: Props) {
  const focus = useWindowStore((s) => s.focus);
  const close = useWindowStore((s) => s.close);
  const setBounds = useWindowStore((s) => s.setBounds);
  const toggleMaximize = useWindowStore((s) => s.toggleMaximize);
  const minimize = useWindowStore((s) => s.minimize);
  const focusedId = useWindowStore((s) => s.focusedId);

  const app = apps[w.appId as keyof typeof apps];
  if (!app) return null;
  const Body = app.component;

  if (w.minimized) return null;

  const isFocused = focusedId === w.id;

  return (
    <Rnd
      size={{ width: w.bounds.width, height: w.bounds.height }}
      position={{ x: w.bounds.x, y: w.bounds.y }}
      minWidth={MIN_W}
      minHeight={MIN_H}
      bounds="parent"
      dragHandleClassName="title-bar"
      cancel=".title-bar-controls,.title-bar-controls *"
      disableDragging={w.maximized}
      enableResizing={!w.maximized}
      onDragStart={() => focus(w.id)}
      onMouseDown={() => focus(w.id)}
      onDragStop={(_, d) => setBounds(w.id, { x: d.x, y: d.y })}
      onResizeStop={(_, __, ref, ___, position) => {
        setBounds(w.id, {
          width: parseInt(ref.style.width, 10),
          height: parseInt(ref.style.height, 10),
          x: position.x,
          y: position.y,
        });
      }}
      style={{ zIndex: w.zIndex }}
    >
      <div
        className="window"
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          opacity: isFocused ? 1 : 0.97,
        }}
      >
        <div
          className="title-bar"
          style={{ filter: isFocused ? undefined : "saturate(0.4)" }}
          onDoubleClick={() => toggleMaximize(w.id)}
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
        <div
          className="window-body"
          style={{
            flex: 1,
            margin: 0,
            padding: 0,
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Body {...(w.props ?? {})} />
        </div>
      </div>
    </Rnd>
  );
}
