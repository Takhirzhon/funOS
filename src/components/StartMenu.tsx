import { useWindowStore } from "../store/windowStore";
import { apps, type AppId } from "../apps/registry";
import { MyComputerIcon, NotepadIcon, InfoIcon, RecycleBinIcon } from "../icons";
import type { ReactNode } from "react";

type Props = { onClose: () => void };

const leftItems: { appId: AppId; label: string; icon: ReactNode; sub?: string }[] = [
  { appId: "notepad", label: "Notepad", icon: <NotepadIcon size={28} />, sub: "Plain-text editor" },
  { appId: "about", label: "About funOS", icon: <InfoIcon size={28} />, sub: "Project info" },
];

const rightItems: { appId: AppId; label: string; icon: ReactNode }[] = [
  { appId: "myComputer", label: "My Computer", icon: <MyComputerIcon size={22} /> },
  { appId: "recycleBin", label: "Recycle Bin", icon: <RecycleBinIcon size={22} /> },
];

export function StartMenu({ onClose }: Props) {
  const open = useWindowStore((s) => s.open);

  const launch = (appId: AppId) => {
    const app = apps[appId];
    open(appId, { title: app.title, bounds: app.defaultSize });
    onClose();
  };

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        bottom: 30,
        width: 380,
        height: 460,
        zIndex: 10000,
        boxShadow: "2px 2px 6px rgba(0,0,0,0.4)",
        border: "1px solid #0a3290",
        borderBottom: "none",
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
        overflow: "hidden",
        fontSize: 11,
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header bar */}
      <div
        style={{
          height: 56,
          background:
            "linear-gradient(to bottom, #1f5fc7 0%, #2f7be0 50%, #1f5fc7 100%)",
          display: "flex",
          alignItems: "center",
          padding: "0 12px",
          gap: 10,
          color: "#fff",
          borderBottom: "2px solid #f6a623",
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: "#fff",
            border: "2px solid #fff",
            display: "grid",
            placeItems: "center",
            color: "#1f5fc7",
            fontWeight: "bold",
            fontSize: 18,
          }}
        >
          U
        </div>
        <div style={{ fontWeight: "bold", fontSize: 14, textShadow: "1px 1px 1px #000" }}>
          User
        </div>
      </div>

      {/* Two columns */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <div style={{ flex: 1, background: "#fff", padding: "8px 4px" }}>
          {leftItems.map((it) => (
            <MenuItem
              key={it.appId}
              icon={it.icon}
              label={it.label}
              sub={it.sub}
              onClick={() => launch(it.appId)}
            />
          ))}
        </div>
        <div
          style={{
            width: 170,
            background: "#d3e5fa",
            padding: "8px 4px",
            borderLeft: "1px solid #b0c8e8",
          }}
        >
          {rightItems.map((it) => (
            <MenuItem
              key={it.appId}
              icon={it.icon}
              label={it.label}
              onClick={() => launch(it.appId)}
              compact
            />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          height: 38,
          background:
            "linear-gradient(to bottom, #1f5fc7 0%, #2f7be0 50%, #1f5fc7 100%)",
          color: "#fff",
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          padding: "0 12px",
          gap: 12,
          borderTop: "2px solid #f6a623",
          fontSize: 11,
        }}
      >
        <span style={{ textShadow: "1px 1px 1px #000" }}>Log Off</span>
        <span style={{ textShadow: "1px 1px 1px #000" }}>Turn Off Computer</span>
      </div>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  sub,
  onClick,
  compact,
}: {
  icon: ReactNode;
  label: string;
  sub?: string;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        all: "unset",
        cursor: "default",
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        boxSizing: "border-box",
        padding: compact ? "4px 8px" : "6px 8px",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = "linear-gradient(to bottom, #316ac5, #1c52a8)")
      }
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      onFocus={(e) =>
        (e.currentTarget.style.background = "linear-gradient(to bottom, #316ac5, #1c52a8)")
      }
      onBlur={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <span style={{ width: compact ? 22 : 28, display: "grid", placeItems: "center" }}>{icon}</span>
      <span style={{ display: "flex", flexDirection: "column", color: "inherit" }}>
        <span style={{ fontWeight: compact ? "normal" : "bold" }}>{label}</span>
        {sub && <span style={{ fontSize: 10, opacity: 0.85 }}>{sub}</span>}
      </span>
    </button>
  );
}
