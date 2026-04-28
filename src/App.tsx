import "./App.css";
import { Desktop } from "./components/Desktop";
import { Window } from "./components/Window";
import { Taskbar } from "./components/Taskbar";
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
    </>
  );
}
