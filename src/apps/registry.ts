import { lazy, type ComponentType, type CSSProperties } from "react";
import { RecycleBinAppIcon } from "./appIcons";
import {
  CalculatorIcon,
  CardsIcon,
  DisplayPropertiesIcon,
  ConsoleIcon,
  MineIcon,
  DocumentsIcon,
  IEIcon,
  PaintIcon,
  InfoIcon,
  MediaPlayerIcon,
  MyComputerIcon,
  NotepadIcon,
  PictureViewerIcon,
  ReaderIcon,
  SystemPropertiesIcon,
} from "../icons";

export type IconComponent = ComponentType<{
  size?: number;
  style?: CSSProperties;
  className?: string;
}>;

export type AppComponent = ComponentType<Record<string, unknown>>;

/* Every app is code-split.
 *
 * The entry bundle is capped at 120KB gzipped by CI and the applications are
 * what fill it - Paint alone is a canvas, a tool box and a palette that nobody
 * who only wants to read a text file should have to download. Splitting here
 * and nowhere else works because this file is the only thing that names an
 * app's component: the desktop, the taskbar and the Start menu all reach it
 * through this table, and none of them ever did more than render it.
 *
 * The wrapper exists because `lazy` wants a module with a default export and
 * these are all named ones - writing that reshaping out at each call site is
 * the kind of noise that gets copied wrong on the fifth app.
 */
const app = (load: () => Promise<Record<string, unknown>>, name: string): AppComponent =>
  lazy(async () => ({ default: (await load())[name] as AppComponent }));

type AppDef = {
  /** Window caption. */
  title: string;
  /** Shorter name for the desktop and the Start menu, where the caption is too long. */
  label: string;
  component: AppComponent;
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
  /* First, so it is first on the desktop: the front door of the portfolio.
   * XP put an IE icon there too, until SP2 tidied it into the Start menu. */
  internetExplorer: {
    title: "Internet Explorer",
    label: "Internet Explorer",
    component: app(() => import("./InternetExplorer"), "InternetExplorer"),
    icon: IEIcon,
    defaultSize: { width: 780, height: 580 },
    onDesktop: true,
  },
  myComputer: {
    title: "My Computer",
    label: "My Computer",
    component: app(() => import("./MyComputer"), "MyComputer"),
    icon: MyComputerIcon,
    defaultSize: { width: 560, height: 400 },
    onDesktop: true,
  },
  explorer: {
    title: "My Documents",
    label: "My Documents",
    component: app(() => import("./Explorer"), "Explorer"),
    icon: DocumentsIcon,
    defaultSize: { width: 660, height: 460 },
    onDesktop: true,
  },
  /* Not on the desktop and not in the Start menu: it is opened by
   * double-clicking a picture, the way Windows Picture and Fax Viewer was. */
  imageViewer: {
    title: "Windows Picture Viewer",
    label: "Picture Viewer",
    component: app(() => import("./ImageViewer"), "ImageViewer"),
    icon: PictureViewerIcon,
    defaultSize: { width: 620, height: 480 },
    onDesktop: false,
  },
  /* Opened by a video or an audio file, and from All Programs - WMP was the
   * one media app on the machine, and it lived in the Start menu. */
  mediaPlayer: {
    title: "Windows Media Player",
    label: "Windows Media Player",
    component: app(() => import("./MediaPlayer"), "MediaPlayer"),
    icon: MediaPlayerIcon,
    defaultSize: { width: 640, height: 520 },
    onDesktop: false,
  },
  /* Opened by a .pdf - the CV on the desktop is the reason it exists. */
  pdfReader: {
    title: "PDF Reader",
    label: "PDF Reader",
    component: app(() => import("./PdfReader"), "PdfReader"),
    icon: ReaderIcon,
    defaultSize: { width: 720, height: 560 },
    onDesktop: false,
  },
  recycleBin: {
    title: "Recycle Bin",
    label: "Recycle Bin",
    component: app(() => import("./RecycleBin"), "RecycleBin"),
    icon: RecycleBinAppIcon,
    defaultSize: { width: 480, height: 340 },
    onDesktop: true,
  },
  paint: {
    title: "untitled - Paint",
    label: "Paint",
    component: app(() => import("./Paint"), "Paint"),
    icon: PaintIcon,
    defaultSize: { width: 720, height: 560 },
    onDesktop: false,
  },
  commandPrompt: {
    title: "Command Prompt",
    label: "Command Prompt",
    component: app(() => import("./CommandPrompt"), "CommandPrompt"),
    icon: ConsoleIcon,
    defaultSize: { width: 620, height: 380 },
    onDesktop: false,
  },
  minesweeper: {
    title: "Minesweeper",
    label: "Minesweeper",
    component: app(() => import("./Minesweeper"), "Minesweeper"),
    icon: MineIcon,
    defaultSize: { width: 340, height: 420 },
    onDesktop: false,
  },
  displayProperties: {
    title: "Display Properties",
    label: "Display Properties",
    component: app(() => import("./DisplayProperties"), "DisplayProperties"),
    icon: DisplayPropertiesIcon,
    defaultSize: { width: 420, height: 470 },
    onDesktop: false,
  },
  /* Right-click My Computer > Properties, or sysdm.cpl in Run. */
  systemProperties: {
    title: "System Properties",
    label: "System Properties",
    component: app(() => import("./SystemProperties"), "SystemProperties"),
    icon: SystemPropertiesIcon,
    defaultSize: { width: 420, height: 460 },
    onDesktop: false,
  },
  solitaire: {
    title: "Solitaire",
    label: "Solitaire",
    component: app(() => import("./Solitaire"), "Solitaire"),
    icon: CardsIcon,
    defaultSize: { width: 700, height: 520 },
    onDesktop: false,
  },
  calculator: {
    title: "Calculator",
    label: "Calculator",
    component: app(() => import("./Calculator"), "Calculator"),
    icon: CalculatorIcon,
    defaultSize: { width: 300, height: 300 },
    onDesktop: false,
  },
  notepad: {
    title: "Untitled - Notepad",
    label: "Notepad",
    component: app(() => import("./Notepad"), "Notepad"),
    icon: NotepadIcon,
    defaultSize: { width: 520, height: 380 },
    onDesktop: true,
  },
  about: {
    title: "About funOS",
    label: "About funOS",
    component: app(() => import("./About"), "About"),
    icon: InfoIcon,
    defaultSize: { width: 420, height: 300 },
    onDesktop: true,
  },
} satisfies Record<string, AppDef>;

export type AppId = keyof typeof apps;

export const appIds = Object.keys(apps) as AppId[];
