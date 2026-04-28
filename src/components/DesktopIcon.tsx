import { useState, type ReactNode } from "react";

type Props = {
  label: string;
  icon: ReactNode;
  onOpen: () => void;
};

export function DesktopIcon({ label, icon, onOpen }: Props) {
  const [selected, setSelected] = useState(false);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setSelected(true);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      onBlur={() => setSelected(false)}
      style={{
        all: "unset",
        width: 76,
        cursor: "default",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        padding: 4,
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          display: "grid",
          placeItems: "center",
          background: selected ? "rgba(0, 64, 200, 0.45)" : "transparent",
          border: selected ? "1px dotted #fff" : "1px dotted transparent",
          padding: 2,
        }}
      >
        {icon}
      </div>
      <span
        style={{
          color: "#fff",
          fontSize: 11,
          textShadow: "1px 1px 1px rgba(0,0,0,0.85)",
          padding: "1px 3px",
          background: selected ? "#0a246a" : "transparent",
          border: selected ? "1px dotted #fff" : "1px dotted transparent",
          maxWidth: 72,
          wordBreak: "break-word",
          lineHeight: 1.15,
        }}
      >
        {label}
      </span>
    </button>
  );
}
