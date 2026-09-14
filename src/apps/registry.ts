import type { ComponentType, CSSProperties } from "react";
import { Notepad } from "./Notepad";
import { MyComputer } from "./MyComputer";
import { Explorer } from "./Explorer";
import { About } from "./About";
import { RecycleBin } from "./RecycleBin";
import {
  DocumentsIcon,
  InfoIcon,
  MyComputerIcon,
  NotepadIcon,
  RecycleBinIcon,
} from "../icons";

export type IconComponent = ComponentType<{
  size?: number;
  style?: CSSProperties;
  className?: string;
}>;

type AppDef = {
  /** Window caption. */
  title: string;
  /** Shorter name for the desktop and the Start menu, where the caption is too long. */
  label: string;
  component: ComponentType<Record<string, unknown>>;
  icon: IconComponent;
  defaultSize: { width: number; height: number };
  /** Whether it gets a desktop icon. Everything appears in the Start menu. */
  onDesktop: boolean;
};

/* One entry per app, and the single source of truth for its icon.
 *
 * The icon used to live in Desktop.tsx's own list, which meant the taskbar had
 * no way to know what an app looked like and the two lists could disagree about
 * what a window is called. Anything that needs to show an app - desktop, task
 * button, Start menu, Alt+Tab later - reads it from here.
 */
export const apps = {
  myComputer: {
    title: "My Computer",
    label: "My Computer",
    component: MyComputer as ComponentType<Record<string, unknown>>,
    icon: MyComputerIcon,
    defaultSize: { width: 560, height: 400 },
    onDesktop: true,
  },
  explorer: {
    title: "My Documents",
    label: "My Documents",
    component: Explorer as ComponentType<Record<string, unknown>>,
    icon: DocumentsIcon,
    defaultSize: { width: 660, height: 460 },
    onDesktop: true,
  },
  recycleBin: {
    title: "Recycle Bin",
    label: "Recycle Bin",
    component: RecycleBin as ComponentType<Record<string, unknown>>,
    icon: RecycleBinIcon,
    defaultSize: { width: 480, height: 340 },
    onDesktop: true,
  },
  notepad: {
    title: "Untitled - Notepad",
    label: "Notepad",
    component: Notepad as ComponentType<Record<string, unknown>>,
    icon: NotepadIcon,
    defaultSize: { width: 520, height: 380 },
    onDesktop: true,
  },
  about: {
    title: "About funOS",
    label: "About funOS",
    component: About as ComponentType<Record<string, unknown>>,
    icon: InfoIcon,
    defaultSize: { width: 420, height: 300 },
    onDesktop: true,
  },
} satisfies Record<string, AppDef>;

export type AppId = keyof typeof apps;

export const appIds = Object.keys(apps) as AppId[];
