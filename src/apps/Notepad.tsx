import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "funos.notepad.body";

export function Notepad() {
  const [text, setText] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  });
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, text);
      setSavedAt(Date.now());
    }, 400);
    return () => clearTimeout(id);
  }, [text]);

  const newDoc = () => {
    if (text && !confirm("Discard current text?")) return;
    setText("");
  };

  const saveAs = () => {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "untitled.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const openFile = () => fileInput.current?.click();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <MenuBar
        items={[
          {
            label: "File",
            children: [
              { label: "New", onClick: newDoc },
              { label: "Open...", onClick: openFile },
              { label: "Save As...", onClick: saveAs },
            ],
          },
          {
            label: "Edit",
            children: [
              { label: "Select All", onClick: () => document.execCommand("selectAll") },
            ],
          },
          {
            label: "Help",
            children: [
              { label: "About Notepad", onClick: () => alert("funOS Notepad\nA Notepad clone, built with React.") },
            ],
          },
        ]}
      />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        style={{
          flex: 1,
          margin: 0,
          padding: 4,
          border: "none",
          outline: "none",
          resize: "none",
          font: "12px Lucida Console, Consolas, monospace",
          width: "100%",
          background: "#fff",
        }}
      />
      <div
        style={{
          height: 18,
          borderTop: "1px solid #aca899",
          background: "#ece9d8",
          fontSize: 10,
          padding: "0 6px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: "#333",
        }}
      >
        <span>{text.length} chars</span>
        <span>{savedAt ? "Auto-saved" : "Not saved"}</span>
      </div>

      <input
        type="file"
        accept=".txt,text/plain"
        ref={fileInput}
        style={{ display: "none" }}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setText(await f.text());
          e.target.value = "";
        }}
      />
    </div>
  );
}

type MenuItem = { label: string; onClick: () => void };
type Menu = { label: string; children: MenuItem[] };

function MenuBar({ items }: { items: Menu[] }) {
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(null);
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div
      style={{
        background: "#ece9d8",
        borderBottom: "1px solid #aca899",
        display: "flex",
        height: 20,
        fontSize: 11,
        flexShrink: 0,
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {items.map((m) => (
        <div key={m.label} style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setOpen(open === m.label ? null : m.label)}
            style={{
              all: "unset",
              padding: "0 8px",
              height: "100%",
              cursor: "default",
              background: open === m.label ? "#316ac5" : "transparent",
              color: open === m.label ? "#fff" : "#000",
            }}
          >
            {m.label}
          </button>
          {open === m.label && (
            <div
              style={{
                position: "absolute",
                top: 20,
                left: 0,
                background: "#fff",
                border: "1px solid #888",
                boxShadow: "2px 2px 4px rgba(0,0,0,0.3)",
                minWidth: 140,
                padding: "2px 0",
                zIndex: 100,
              }}
            >
              {m.children.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => {
                    c.onClick();
                    setOpen(null);
                  }}
                  style={{
                    all: "unset",
                    display: "block",
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "3px 18px",
                    cursor: "default",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#316ac5";
                    e.currentTarget.style.color = "#fff";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "#000";
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
