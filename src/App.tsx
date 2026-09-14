import "./App.css";
import { Desktop } from "./components/Desktop";
import { Window } from "./components/Window";
import { Taskbar } from "./components/Taskbar";
import { ContextMenu } from "./components/ContextMenu";
import { Dialog } from "./components/Dialog";
import { useWindowStore } from "./store/windowStore";

export default function App() {
  const windows = useWindowStore((s) => s.windows);

  return (
    <>
      <Desktop />
      <div className="window-host">
        {windows.map((w) => (
          <Window key={w.id} window={w} />
        ))}
      </div>
      <Taskbar />
      {/* Last, and mounted once: the context menu has to draw over every window
          and over the taskbar, and there should only ever be one of it. */}
      <ContextMenu />
      {/* Above even the context menu: a modal dialog is the one thing that
          should win against everything else on screen. */}
      <Dialog />
    </>
  );
}
