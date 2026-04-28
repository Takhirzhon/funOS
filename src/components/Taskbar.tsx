import { useEffect, useState } from "react";
import { useWindowStore } from "../store/windowStore";
import { StartButton } from "./StartButton";
import { StartMenu } from "./StartMenu";
import { Clock } from "./Clock";

export function Taskbar() {
  const windows = useWindowStore((s) => s.windows);
  const focusedId = useWindowStore((s) => s.focusedId);
  const toggleFromTaskbar = useWindowStore((s) => s.toggleFromTaskbar);
  const [startOpen, setStartOpen] = useState(false);

  useEffect(() => {
    if (!startOpen) return;
    const close = () => setStartOpen(false);
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [startOpen]);

  return (
    <>
      {startOpen && <StartMenu onClose={() => setStartOpen(false)} />}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 30,
          background: "var(--xp-taskbar)",
          borderTop: "1px solid #1c52a8",
          display: "flex",
          alignItems: "stretch",
          zIndex: 9999,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => setStartOpen((v) => !v)}
        >
          <StartButton open={startOpen} onClick={() => setStartOpen((v) => !v)} />
        </div>

        <div style={{ flex: 1, display: "flex", gap: 2, padding: "3px 4px", overflow: "hidden" }}>
          {windows.map((w) => {
            const active = focusedId === w.id && !w.minimized;
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => toggleFromTaskbar(w.id)}
                title={w.title}
                style={{
                  all: "unset",
                  cursor: "default",
                  height: 22,
                  flex: "0 1 160px",
                  minWidth: 90,
                  padding: "0 8px",
                  color: "#fff",
                  fontSize: 11,
                  display: "flex",
                  alignItems: "center",
                  background: active
                    ? "linear-gradient(to bottom, #1c52a8 0%, #3675d4 100%)"
                    : "linear-gradient(to bottom, #3a86e8 0%, #1c52a8 100%)",
                  boxShadow: active
                    ? "inset 1px 1px 2px rgba(0,0,0,0.4)"
                    : "inset 0 1px 0 rgba(255,255,255,0.25)",
                  borderRadius: 2,
                  textShadow: "1px 1px 1px rgba(0,0,0,0.5)",
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                  overflow: "hidden",
                }}
              >
                {w.title}
              </button>
            );
          })}
        </div>

        <Clock />
      </div>
    </>
  );
}
