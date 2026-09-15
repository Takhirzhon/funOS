import { InfoIcon } from "../icons";
import { useWindowStore } from "../store/windowStore";
import { apps } from "./registry";
import { cv } from "virtual:portfolio";

export function About() {
  const open = useWindowStore((s) => s.open);
  const homePage = () =>
    open("internetExplorer", {
      title: apps.internetExplorer.title,
      bounds: apps.internetExplorer.defaultSize,
      props: { url: "about:me" },
    });

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
        {/* The line every About box had, and the one this one was missing:
            whose it is. The link opens the home page in Internet Explorer,
            which is where the rest of that answer lives. */}
        <div style={{ marginTop: 8, color: "#444" }}>
          Built by{" "}
          <a
            href="about:me"
            onClick={(e) => {
              e.preventDefault();
              homePage();
            }}
          >
            {cv.name}
          </a>
          , {cv.location.city}. Source on{" "}
          <a href="https://github.com/Takhirzhon/funOS" target="_blank" rel="noreferrer">
            GitHub
          </a>
          .
        </div>
        <div style={{ color: "#444" }}>
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
