import type { ComponentType } from "react";
import { Notepad } from "./Notepad";
import { MyComputer } from "./MyComputer";
import { About } from "./About";
import { RecycleBin } from "./RecycleBin";

type AppDef = {
  title: string;
  component: ComponentType<Record<string, unknown>>;
  defaultSize: { width: number; height: number };
};

export const apps = {
  notepad: {
    title: "Untitled - Notepad",
    component: Notepad as ComponentType<Record<string, unknown>>,
    defaultSize: { width: 520, height: 380 },
  },
  myComputer: {
    title: "My Computer",
    component: MyComputer as ComponentType<Record<string, unknown>>,
    defaultSize: { width: 560, height: 400 },
  },
  recycleBin: {
    title: "Recycle Bin",
    component: RecycleBin as ComponentType<Record<string, unknown>>,
    defaultSize: { width: 480, height: 340 },
  },
  about: {
    title: "About funOS",
    component: About as ComponentType<Record<string, unknown>>,
    defaultSize: { width: 420, height: 300 },
  },
} satisfies Record<string, AppDef>;

export type AppId = keyof typeof apps;
