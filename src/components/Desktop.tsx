import { useWindowStore } from "../store/windowStore";
import { apps } from "../apps/registry";
import { DesktopIcon } from "./DesktopIcon";
import {
  MyComputerIcon,
  RecycleBinIcon,
  NotepadIcon,
  InfoIcon,
} from "../icons";

const desktopApps: { appId: keyof typeof apps; label: string; icon: React.ReactNode }[] = [
  { appId: "myComputer", label: "My Computer", icon: <MyComputerIcon /> },
  { appId: "recycleBin", label: "Recycle Bin", icon: <RecycleBinIcon /> },
  { appId: "notepad", label: "Notepad", icon: <NotepadIcon /> },
  { appId: "about", label: "About funOS", icon: <InfoIcon /> },
];

export function Desktop() {
  const open = useWindowStore((s) => s.open);

  return (
    <div className="desktop">
      <div
        style={{
          padding: 12,
          display: "grid",
          gridAutoFlow: "column",
          gridTemplateRows: "repeat(auto-fill, 92px)",
          gap: 4,
          height: "calc(100% - 30px)",
          alignContent: "start",
          justifyContent: "start",
        }}
      >
        {desktopApps.map((d) => {
          const app = apps[d.appId];
          return (
            <DesktopIcon
              key={d.appId}
              label={d.label}
              icon={d.icon}
              onOpen={() =>
                open(d.appId, {
                  title: app.title,
                  bounds: app.defaultSize,
                })
              }
            />
          );
        })}
      </div>
    </div>
  );
}
