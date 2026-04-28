import { useEffect, useState } from "react";

const fmt = (d: Date) => {
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
};

export function Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000 * 15);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      title={now.toLocaleString()}
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        padding: "0 10px",
        color: "#fff",
        background: "linear-gradient(to bottom, #1290e2 0%, #0a73c4 50%, #1290e2 100%)",
        boxShadow: "inset 1px 0 #0c4d8a, inset -1px 0 rgba(255,255,255,0.18)",
        fontSize: 11,
        minWidth: 64,
        justifyContent: "center",
        userSelect: "none",
      }}
    >
      {fmt(now)}
    </div>
  );
}
