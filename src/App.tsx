import "./App.css";
import { Desktop } from "./components/Desktop";
import { Window } from "./components/Window";
import { Tooltip } from "./components/Tooltip";
import { Taskbar } from "./components/Taskbar";
import { ContextMenu } from "./components/ContextMenu";
import { Dialog } from "./components/Dialog";
import { Balloon } from "./components/Balloon";
import { ScreenSaver } from "./components/ScreenSaver";
import { TaskSwitcher } from "./components/TaskSwitcher";
import { BootScreen, GoodbyeScreen, LoginScreen, TurnOffDialog } from "./boot/Session";
import { BlueScreen } from "./boot/BlueScreen";
import { useWindowStore } from "./store/windowStore";
import { useSessionStore } from "./store/sessionStore";

export default function App() {
  const windows = useWindowStore((s) => s.windows);
  const phase = useSessionStore((s) => s.phase);
  const turningOff = useSessionStore((s) => s.turningOff);

  if (phase === "boot") return <BootScreen />;
  if (phase === "login") return <LoginScreen />;
  if (phase === "goodbye") return <GoodbyeScreen />;
  if (phase === "crash") return <BlueScreen />;

  return (
    <>
      <Desktop />
      <div className="window-host">
        {windows.map((w) => (
          <Window key={w.id} window={w} />
        ))}
      </div>
      <Taskbar />
      <TaskSwitcher />
      {/* Last, and mounted once: the context menu has to draw over every window
          and over the taskbar, and there should only ever be one of it. */}
      <ContextMenu />
      {/* Above even the context menu: a modal dialog is the one thing that
          should win against everything else on screen. */}
      <Dialog />
      <Balloon />
      <Tooltip />
      {turningOff && <TurnOffDialog />}
      {/* Above the dialog layer: a screensaver a dialog could cover would be
          one that failed to save the screen. */}
      <ScreenSaver />
    </>
  );
}
