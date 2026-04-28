import { InfoIcon } from "../icons";

export function About() {
  return (
    <div
      style={{
        padding: 16,
        height: "100%",
        display: "flex",
        gap: 16,
        background: "#fff",
        fontSize: 11,
      }}
    >
      <div style={{ flexShrink: 0 }}>
        <InfoIcon size={56} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 16, fontWeight: "bold" }}>funOS</div>
        <div style={{ color: "#555" }}>
          A Windows XP-style desktop environment, built in the browser.
        </div>
        <div style={{ color: "#555" }}>
          React + TypeScript + Vite + xp.css + Zustand + react-rnd.
        </div>
        <div style={{ marginTop: 8, color: "#444" }}>
          Inspired by{" "}
          <a href="https://github.com/DustinBrett/daedalOS" target="_blank" rel="noreferrer">
            daedalOS
          </a>
          .
        </div>
      </div>
    </div>
  );
}
