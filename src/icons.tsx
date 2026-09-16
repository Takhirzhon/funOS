/* The icon set: Windows XP's own.
 *
 * These used to be SVG lookalikes drawn to XP's grammar, and the reasoning was
 * the entry budget - a raster set at 16/32/48px is several hundred KB, and the
 * shell is gated at 120KB gzipped. Both facts are still true; what changed is
 * where the pixels live. The icons are files under public/icons/xp/, fetched
 * by <img> when something on screen actually shows them, and the bundle
 * carries only the names. First paint fetches the eight on the desktop and
 * nothing else.
 *
 * Source: softwarehistorysociety/XPIcons, 1024px renders of the originals,
 * reduced to 96px (anything drawn at 32 or 48, and still sharp at 2x) and 24px
 * (the tray, task buttons, list view, the Start menu's right column). WebP
 * with alpha at q90; 48 icons, 186KB, none of it on the critical path. The
 * recipe is in public/icons/xp/README.md.
 *
 * The artwork is Microsoft's, the same way Bliss is - see TODO.md. Two are
 * still SVG here: the flag, whose paths are the 2002 logo's own with the
 * Start button's lighting put back, and the PDF badge, which XP never had.
 *
 * Every export keeps the signature it had as an SVG - `size`, `style`,
 * `className` - so nothing that renders an icon knows or cares what it is.
 */
import type { CSSProperties } from "react";

type IconProps = {
  size?: number;
  style?: CSSProperties;
  className?: string;
};

const box = (size: number, style?: CSSProperties): CSSProperties => ({
  width: size,
  height: size,
  display: "inline-block",
  verticalAlign: "middle",
  flex: "none",
  ...style,
});

/* The cut-off between the two renders. 24 is the largest thing the small file
 * is drawn at, and a 32px icon scaled up from 24 is exactly the blur this
 * exists to avoid. */
const SMALL = 24;

/* One <img>, and every icon is a one-line component around it - written out
 * rather than produced by a factory so that each export is a component to
 * fast refresh and to anyone reading the file. */
function Xp({ name, size = 32, style, className }: IconProps & { name: string }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}icons/xp/${name}${size <= SMALL ? "-s" : ""}.webp`}
      width={size}
      height={size}
      style={box(size, style)}
      className={className}
      alt=""
      draggable={false}
      aria-hidden
    />
  );
}

/* ---- Desktop and shell ---------------------------------------------------- */

export const MyComputerIcon = (p: IconProps) => <Xp name="my-computer" {...p} />;
export const RecycleBinIcon = (p: IconProps) => <Xp name="recycle-bin-empty" {...p} />;
export const RecycleBinFullIcon = (p: IconProps) => <Xp name="recycle-bin-full" {...p} />;
export const NotepadIcon = (p: IconProps) => <Xp name="notepad" {...p} />;
export const TextDocumentIcon = (p: IconProps) => <Xp name="text-document" {...p} />;
export const HtmlIcon = (p: IconProps) => <Xp name="html" {...p} />;
export const FolderIcon = (p: IconProps) => <Xp name="folder" {...p} />;
export const FolderOpenIcon = (p: IconProps) => <Xp name="folder-open" {...p} />;
export const FileIcon = (p: IconProps) => <Xp name="document" {...p} />;
export const PictureIcon = (p: IconProps) => <Xp name="picture" {...p} />;
export const VideoIcon = (p: IconProps) => <Xp name="video" {...p} />;
export const MusicIcon = (p: IconProps) => <Xp name="audio" {...p} />;
export const MediaPlayerIcon = (p: IconProps) => <Xp name="media-player" {...p} />;
export const PictureViewerIcon = (p: IconProps) => <Xp name="picture-viewer" {...p} />;
export const ReaderIcon = (p: IconProps) => <Xp name="viewer" {...p} />;
export const PaintIcon = (p: IconProps) => <Xp name="paint" {...p} />;
export const ConsoleIcon = (p: IconProps) => <Xp name="command-prompt" {...p} />;
export const CardsIcon = (p: IconProps) => <Xp name="solitaire" {...p} />;
export const MineIcon = (p: IconProps) => <Xp name="minesweeper" {...p} />;
export const CalculatorIcon = (p: IconProps) => <Xp name="calculator" {...p} />;
export const DriveIcon = (p: IconProps) => <Xp name="local-disk" {...p} />;
export const CdDriveIcon = (p: IconProps) => <Xp name="cd-rom" {...p} />;
export const RemovableDriveIcon = (p: IconProps) => <Xp name="removable" {...p} />;
export const InfoIcon = (p: IconProps) => <Xp name="information" {...p} />;
export const ErrorIcon = (p: IconProps) => <Xp name="critical" {...p} />;
export const QuestionIcon = (p: IconProps) => <Xp name="question" {...p} />;
export const WarningIcon = (p: IconProps) => <Xp name="alert" {...p} />;
export const SystemPropertiesIcon = (p: IconProps) => <Xp name="system-properties" {...p} />;
export const TaskManagerIcon = (p: IconProps) => <Xp name="task-manager" {...p} />;
export const UserAccountsIcon = (p: IconProps) => <Xp name="user-accounts" {...p} />;

/* The special folders: Explorer draws these with their own picture, and the
 * user's profile is where anyone who has used XP expects to see them. */
export const DesktopFolderIcon = (p: IconProps) => <Xp name="desktop" {...p} />;
export const MyPicturesIcon = (p: IconProps) => <Xp name="my-pictures" {...p} />;
export const MyMusicIcon = (p: IconProps) => <Xp name="my-music" {...p} />;
export const MyVideosIcon = (p: IconProps) => <Xp name="my-videos" {...p} />;

/* ---- Start menu ----------------------------------------------------------- */

export const DocumentsIcon = ({ size = 24, ...p }: IconProps) => <Xp name="my-documents" size={size} {...p} />;
export const ControlPanelIcon = ({ size = 24, ...p }: IconProps) => <Xp name="control-panel" size={size} {...p} />;
export const DisplayPropertiesIcon = ({ size = 24, ...p }: IconProps) => <Xp name="display-properties" size={size} {...p} />;
export const HelpIcon = ({ size = 24, ...p }: IconProps) => <Xp name="help" size={size} {...p} />;
export const SearchIcon = ({ size = 24, ...p }: IconProps) => <Xp name="search" size={size} {...p} />;
export const RunIcon = ({ size = 24, ...p }: IconProps) => <Xp name="run" size={size} {...p} />;
/* Control Panel's applets, at the size the classic view drew them. */
export const AccessibilityIcon = (p: IconProps) => <Xp name="accessibility" {...p} />;
export const AddHardwareIcon = (p: IconProps) => <Xp name="add-hardware" {...p} />;
export const AddRemoveProgramsIcon = (p: IconProps) => <Xp name="add-remove-programs" {...p} />;
export const AudioDevicesIcon = (p: IconProps) => <Xp name="audio-devices" {...p} />;
export const DateTimeIcon = (p: IconProps) => <Xp name="date-time" {...p} />;
export const FolderOptionsIcon = (p: IconProps) => <Xp name="folder-options" {...p} />;
export const FontsIcon = (p: IconProps) => <Xp name="fonts" {...p} />;
export const GameControllerIcon = (p: IconProps) => <Xp name="game-controller" {...p} />;
export const InternetOptionsIcon = (p: IconProps) => <Xp name="internet-options" {...p} />;
export const KeyboardIcon = (p: IconProps) => <Xp name="keyboard" {...p} />;
export const MouseIcon = (p: IconProps) => <Xp name="mouse" {...p} />;
export const NetworkConnectionsIcon = (p: IconProps) => <Xp name="network-connections" {...p} />;
export const PhoneModemIcon = (p: IconProps) => <Xp name="phone-modem" {...p} />;
export const PowerOptionsIcon = (p: IconProps) => <Xp name="power-options" {...p} />;
export const PrintersIcon = (p: IconProps) => <Xp name="printers" {...p} />;
export const RegionalIcon = (p: IconProps) => <Xp name="regional" {...p} />;
export const ScannersCamerasIcon = (p: IconProps) => <Xp name="scanners-cameras" {...p} />;
export const ScheduledTasksIcon = (p: IconProps) => <Xp name="scheduled-tasks" {...p} />;
export const SecurityCenterIcon = (p: IconProps) => <Xp name="security" {...p} />;
export const TaskbarStartMenuIcon = (p: IconProps) => <Xp name="taskbar-start-menu" {...p} />;
export const RecentDocumentsIcon = ({ size = 24, ...p }: IconProps) => <Xp name="recent-documents" size={size} {...p} />;
export const LogOffIcon = ({ size = 20, ...p }: IconProps) => <Xp name="log-off" size={size} {...p} />;
export const ShutdownIcon = ({ size = 20, ...p }: IconProps) => <Xp name="power" size={size} {...p} />;
export const RestartIcon = ({ size = 20, ...p }: IconProps) => <Xp name="restart" size={size} {...p} />;
export const StandByIcon = ({ size = 20, ...p }: IconProps) => <Xp name="stand-by" size={size} {...p} />;

/* ---- Notification area ---------------------------------------------------- */

export const VolumeIcon = ({ size = 16, ...p }: IconProps) => <Xp name="volume" size={size} {...p} />;
export const VolumeMuteIcon = ({ size = 16, ...p }: IconProps) => <Xp name="mute" size={size} {...p} />;
export const NetworkIcon = ({ size = 16, ...p }: IconProps) => <Xp name="network" size={size} {...p} />;
export const ShieldIcon = ({ size = 16, ...p }: IconProps) => <Xp name="security" size={size} {...p} />;
export const ShowDesktopIcon = ({ size = 16, ...p }: IconProps) => <Xp name="desktop" size={size} {...p} />;
export const IEIcon = ({ size = 16, ...p }: IconProps) => <Xp name="internet-explorer" size={size} {...p} />;

/* ---- Internet Explorer's toolbar ------------------------------------------- */

export const BackIcon = ({ size = 22, ...p }: IconProps) => <Xp name="back" size={size} {...p} />;
export const ForwardIcon = ({ size = 22, ...p }: IconProps) => <Xp name="forward" size={size} {...p} />;
export const StopIcon = ({ size = 22, ...p }: IconProps) => <Xp name="ie-stop" size={size} {...p} />;
export const RefreshIcon = ({ size = 22, ...p }: IconProps) => <Xp name="ie-refresh" size={size} {...p} />;
export const HomeIcon = ({ size = 22, ...p }: IconProps) => <Xp name="ie-home" size={size} {...p} />;
export const FavoritesIcon = ({ size = 22, ...p }: IconProps) => <Xp name="favorites" size={size} {...p} />;
export const HistoryIcon = ({ size = 22, ...p }: IconProps) => <Xp name="ie-history" size={size} {...p} />;
export const GoIcon = ({ size = 16, ...p }: IconProps) => <Xp name="go" size={size} {...p} />;
export const InternetShortcutIcon = ({ size = 16, ...p }: IconProps) => <Xp name="internet-shortcut" size={size} {...p} />;
export const EmailIcon = ({ size = 28, ...p }: IconProps) => <Xp name="email" size={size} {...p} />;

/* ---- Still drawn ---------------------------------------------------------- */

/* DOOM's: the letters on a slab of the metal every wall in it was made of.
 * The game's own icon is id's; this is the shape of it. */
export const DoomIcon = ({ size = 32, style, className }: IconProps) => (
  <svg viewBox="0 0 32 32" style={box(size, style)} className={className} aria-hidden>
    <defs>
      <linearGradient id="doom-slab" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#6b6b6b" />
        <stop offset="1" stopColor="#242424" />
      </linearGradient>
      <linearGradient id="doom-fire" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#ffd25a" />
        <stop offset="0.45" stopColor="#ff6a00" />
        <stop offset="1" stopColor="#8c0d00" />
      </linearGradient>
    </defs>
    <rect x="2" y="3" width="28" height="26" rx="2" fill="url(#doom-slab)" stroke="#111" />
    <rect x="3.5" y="4.5" width="25" height="23" rx="1.5" fill="none" stroke="#8d8d8d" strokeWidth="0.8" opacity="0.6" />
    <text
      x="16"
      y="21.5"
      textAnchor="middle"
      fontFamily="Impact, 'Arial Black', sans-serif"
      fontSize="12.5"
      fontWeight="900"
      fill="url(#doom-fire)"
      stroke="#3a0600"
      strokeWidth="0.5"
    >
      DOOM
    </text>
  </svg>
);

/* Acrobat's document: the same page as every other file, with the red band
 * that made a PDF recognisable across a room in 2004. */
export const PdfIcon = ({ size = 32, style, className }: IconProps) => (
  <svg viewBox="0 0 32 32" style={box(size, style)} className={className} aria-hidden>
    <defs>
      <linearGradient id="pdf-page" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="1" stopColor="#e3e8ed" />
      </linearGradient>
      <linearGradient id="pdf-band" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#f0645a" />
        <stop offset="1" stopColor="#b8221a" />
      </linearGradient>
    </defs>
    <path d="M7 3h12l6 6v20H7z" fill="url(#pdf-page)" stroke="#8794a1" strokeWidth="0.9" />
    <path d="M19 3v6h6" fill="#cdd7e0" stroke="#8794a1" strokeWidth="0.9" />
    <rect x="4.5" y="15" width="19" height="9" rx="1" fill="url(#pdf-band)" stroke="#8a1a12" strokeWidth="0.8" />
    <text
      x="14"
      y="21.8"
      textAnchor="middle"
      fontFamily="Arial, Helvetica, sans-serif"
      fontWeight="700"
      fontSize="6.4"
      fill="#fff"
    >
      PDF
    </text>
  </svg>
);

/* The flag. The four panes are the 2002 Windows logo's own paths - the one
 * on the Start button, the boot screen and the tab - from Wikimedia Commons'
 * "Windows logo - 2002–2012 (Multicolored).svg". The logo was flat there;
 * on the button XP lit it from the upper left and dropped a shadow under it,
 * which is what the gradients and the caller's filter put back. Microsoft's
 * mark, used the way Bliss is. */
export const StartLogoIcon = ({ size = 18, style, className }: IconProps) => (
  <svg viewBox="0 0 170 150" style={box(size, style)} className={className} aria-hidden>
    <defs>
      <linearGradient id="wf-r" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stopColor="#ffa374" />
        <stop offset="0.5" stopColor="#f8682c" />
        <stop offset="1" stopColor="#d9430f" />
      </linearGradient>
      <linearGradient id="wf-g" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stopColor="#c8ea5a" />
        <stop offset="0.5" stopColor="#91c300" />
        <stop offset="1" stopColor="#6c9a00" />
      </linearGradient>
      <linearGradient id="wf-b" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stopColor="#7fdcff" />
        <stop offset="0.5" stopColor="#00b4f1" />
        <stop offset="1" stopColor="#0086c4" />
      </linearGradient>
      <linearGradient id="wf-y" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stopColor="#ffe27a" />
        <stop offset="0.5" stopColor="#ffc300" />
        <stop offset="1" stopColor="#e39a00" />
      </linearGradient>
    </defs>
    <path d="M82.2 67.3a53.9 53.9 0 0 0-31-11.3c-8.7-.1-19.1 2.4-32.2 7.8L35.2 7.4c33.1-13.7 49-6 63.3 3.7L82.2 67.3z" fill="url(#wf-r)" />
    <path d="M170 20.7c-33 13.7-49 6-63.2-3.6L90.8 73.5c14.3 9.7 31.5 17.7 63.2 3.5l16.3-56.3z" fill="url(#wf-g)" />
    <path d="M63 134.2c-14.3-9.6-30-17.6-63-3.9l16.2-56.6c33-13.6 49-5.9 63.3 3.8L63 134.2z" fill="url(#wf-b)" />
    <path d="M88 83c14.4 9.6 30.3 17.3 63.3 3.6L135 142.8c-33 13.7-48.9 6-63.2-3.7L88.1 83z" fill="url(#wf-y)" />
  </svg>
);
