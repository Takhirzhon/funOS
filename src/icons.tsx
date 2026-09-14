/* Inline SVG icon set.
 *
 * Inline rather than a sprite sheet or PNGs for one reason: the entry bundle is
 * gated at 120KB gzipped, and an XP-authentic raster set at 16/32/48px is
 * several hundred KB before it has drawn anything. SVG that gzips to a few
 * hundred bytes per icon buys the fidelity back for almost nothing.
 *
 * These are lookalikes, drawn to the XP icon grammar rather than traced from it:
 *   - a light source at the upper left, always
 *   - a single dark outline, never a stroke on every internal edge
 *   - one soft vertical gradient per surface, plus a white gloss on glass
 *   - 45-degree perspective on anything box-shaped
 *
 * Every gradient id is prefixed with the icon name. Two SVGs on the same page
 * with an id of "gloss" is a real bug and a confusing one: the second element
 * silently inherits the first one's gradient.
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

/* ---- Desktop and shell ---------------------------------------------------- */

export const MyComputerIcon = ({ size = 32, style, className }: IconProps) => (
  <svg viewBox="0 0 32 32" style={box(size, style)} className={className} aria-hidden>
    <defs>
      <linearGradient id="mc-case" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#fdfdfa" />
        <stop offset="0.45" stopColor="#e3e1d4" />
        <stop offset="1" stopColor="#b9b7a8" />
      </linearGradient>
      <linearGradient id="mc-screen" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stopColor="#4e9fe0" />
        <stop offset="0.5" stopColor="#1f6fc0" />
        <stop offset="1" stopColor="#134f93" />
      </linearGradient>
      <linearGradient id="mc-gloss" x1="0" x2="0.6" y1="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0.65" />
        <stop offset="0.6" stopColor="#fff" stopOpacity="0.05" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
    </defs>
    {/* monitor */}
    <rect x="3" y="5" width="26" height="18" rx="2" fill="url(#mc-case)" stroke="#6b6a5e" />
    <rect x="5.5" y="7.5" width="21" height="12.5" rx="1" fill="url(#mc-screen)" />
    <path d="M5.5 7.5h21v7c-7 2.2-14 2.2-21 0z" fill="url(#mc-gloss)" />
    {/* stand and base */}
    <path d="M12 23h8l1 3h-10z" fill="#cfcdbf" stroke="#6b6a5e" strokeWidth="0.8" />
    <rect x="6" y="26" width="20" height="3.5" rx="1.5" fill="url(#mc-case)" stroke="#6b6a5e" />
    <circle cx="9.5" cy="27.8" r="0.7" fill="#4c7f3d" />
  </svg>
);

export const RecycleBinIcon = ({ size = 32, style, className }: IconProps) => (
  <svg viewBox="0 0 32 32" style={box(size, style)} className={className} aria-hidden>
    <defs>
      <linearGradient id="rb-body" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#e9f2f8" />
        <stop offset="0.35" stopColor="#aec6d6" />
        <stop offset="0.65" stopColor="#cfe0ea" />
        <stop offset="1" stopColor="#8ea7b8" />
      </linearGradient>
      <linearGradient id="rb-lid" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#f2f8fc" />
        <stop offset="1" stopColor="#9fb7c8" />
      </linearGradient>
    </defs>
    <path d="M8 10h16l-1.6 18.2a1.4 1.4 0 0 1-1.4 1.3H11a1.4 1.4 0 0 1-1.4-1.3z" fill="url(#rb-body)" stroke="#5d7386" strokeWidth="0.9" />
    {/* the vertical ribs, lighter than the outline so they read as moulding */}
    <path d="M13 13.5 12.4 26M16 13.5V26M19 13.5l.6 12.5" stroke="#7e95a6" strokeWidth="0.9" fill="none" strokeLinecap="round" />
    <ellipse cx="16" cy="10" rx="8.6" ry="2.4" fill="url(#rb-lid)" stroke="#5d7386" strokeWidth="0.9" />
    <rect x="13.4" y="5.4" width="5.2" height="2.6" rx="1.2" fill="#cfe0ea" stroke="#5d7386" strokeWidth="0.9" />
    {/* the recycle triangle, the one thing that identifies this icon at 16px */}
    <path d="M16 15.6l2.2 3.8h-4.4z" fill="#3f8f32" opacity="0.85" />
  </svg>
);

/* The bin with something in it. Same silhouette as the empty one - it has to
 * read as the same object - with crumpled paper above the rim, which is the
 * only part of XP's full-bin icon anyone actually registers.
 */
export const RecycleBinFullIcon = ({ size = 32, style, className }: IconProps) => (
  <svg viewBox="0 0 32 32" style={box(size, style)} className={className} aria-hidden>
    <defs>
      <linearGradient id="rbf-body" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#e9f2f8" />
        <stop offset="0.35" stopColor="#aec6d6" />
        <stop offset="0.65" stopColor="#cfe0ea" />
        <stop offset="1" stopColor="#8ea7b8" />
      </linearGradient>
    </defs>
    {/* paper first, so the bin overlaps it and the sheets sit *inside* */}
    <path d="M10.5 7.5 13 3.8l3.4 2.4L19 3l1.6 3.6 3-1.2-.8 3.4-11.8.9z" fill="#fdfdf7" stroke="#b9b6a6" strokeWidth="0.8" strokeLinejoin="round" />
    <path d="M13.5 6.2l2.2 1.7M18 5.4l.9 2" stroke="#cfcdbd" strokeWidth="0.8" />
    <path d="M8 10h16l-1.6 18.2a1.4 1.4 0 0 1-1.4 1.3H11a1.4 1.4 0 0 1-1.4-1.3z" fill="url(#rbf-body)" stroke="#5d7386" strokeWidth="0.9" />
    <path d="M13 13.5 12.4 26M16 13.5V26M19 13.5l.6 12.5" stroke="#7e95a6" strokeWidth="0.9" fill="none" strokeLinecap="round" />
    <ellipse cx="16" cy="10" rx="8.6" ry="2.4" fill="#cfe0ea" stroke="#5d7386" strokeWidth="0.9" />
    <path d="M16 15.6l2.2 3.8h-4.4z" fill="#3f8f32" opacity="0.85" />
  </svg>
);

export const NotepadIcon = ({ size = 32, style, className }: IconProps) => (
  <svg viewBox="0 0 32 32" style={box(size, style)} className={className} aria-hidden>
    <defs>
      <linearGradient id="np-page" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="1" stopColor="#dfe6ec" />
      </linearGradient>
      <linearGradient id="np-bar" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#7fb2e8" />
        <stop offset="1" stopColor="#2f6cbf" />
      </linearGradient>
    </defs>
    {/* the page, with the folded corner XP uses on every document icon */}
    <path d="M7 3h13l5 5v21H7z" fill="url(#np-page)" stroke="#6b7d8c" strokeWidth="0.9" />
    <path d="M20 3v5h5" fill="#c6d4e0" stroke="#6b7d8c" strokeWidth="0.9" />
    <rect x="9.5" y="10.5" width="13" height="3" fill="url(#np-bar)" />
    <path d="M9.5 17h13M9.5 20h13M9.5 23h9" stroke="#9aa8b5" strokeWidth="1" strokeLinecap="round" />
  </svg>
);

export const FolderIcon = ({ size = 32, style, className }: IconProps) => (
  <svg viewBox="0 0 32 32" style={box(size, style)} className={className} aria-hidden>
    <defs>
      <linearGradient id="fd-back" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#ffd979" />
        <stop offset="1" stopColor="#e8a72e" />
      </linearGradient>
      <linearGradient id="fd-front" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#ffe9a8" />
        <stop offset="0.55" stopColor="#fdcb62" />
        <stop offset="1" stopColor="#e79b1f" />
      </linearGradient>
    </defs>
    <path d="M3 8h9l2.5 3H29v16H3z" fill="url(#fd-back)" stroke="#a8741a" strokeWidth="0.9" />
    <path d="M3 12h26l-2.5 15H5.5z" fill="url(#fd-front)" stroke="#a8741a" strokeWidth="0.9" />
  </svg>
);

/* The generic document. Deliberately plainer than NotepadIcon: in a file list
 * the point is to say "this is a file and it is not a folder", and anything
 * with a recognisable silhouette competes with the names next to it.
 */
export const FileIcon = ({ size = 32, style, className }: IconProps) => (
  <svg viewBox="0 0 32 32" style={box(size, style)} className={className} aria-hidden>
    <defs>
      <linearGradient id="fl-page" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="1" stopColor="#e3e8ed" />
      </linearGradient>
    </defs>
    <path d="M7 3h12l6 6v20H7z" fill="url(#fl-page)" stroke="#8794a1" strokeWidth="0.9" />
    <path d="M19 3v6h6" fill="#cdd7e0" stroke="#8794a1" strokeWidth="0.9" />
    <path d="M10 14h12M10 18h12M10 22h8" stroke="#aab6c2" strokeWidth="1" strokeLinecap="round" />
  </svg>
);

export const PictureIcon = ({ size = 32, style, className }: IconProps) => (
  <svg viewBox="0 0 32 32" style={box(size, style)} className={className} aria-hidden>
    <defs>
      <linearGradient id="pic-sky" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#6fb7ea" />
        <stop offset="1" stopColor="#c7e6f7" />
      </linearGradient>
    </defs>
    <rect x="3" y="6" width="26" height="20" rx="1.5" fill="#fff" stroke="#7a8794" strokeWidth="0.9" />
    <rect x="5" y="8" width="22" height="16" fill="url(#pic-sky)" />
    {/* A hill, a sun and nothing else - at 16px anything more is a smudge */}
    <circle cx="10" cy="12.5" r="2.2" fill="#ffe07a" />
    <path d="M5 24l6.5-7 4.5 4.6 4-3.4L27 24z" fill="#5aa84a" />
  </svg>
);

export const DriveIcon = ({ size = 32, style, className }: IconProps) => (
  <svg viewBox="0 0 32 32" style={box(size, style)} className={className} aria-hidden>
    <defs>
      <linearGradient id="dr-body" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#f6f6f1" />
        <stop offset="0.5" stopColor="#dcd9c8" />
        <stop offset="1" stopColor="#b4b1a1" />
      </linearGradient>
    </defs>
    <path d="M4 12h24v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" fill="url(#dr-body)" stroke="#7a776a" strokeWidth="0.9" />
    <path d="M6 6h20l2 6H4z" fill="#eceadb" stroke="#7a776a" strokeWidth="0.9" />
    <rect x="7" y="16" width="13" height="2.4" rx="1.2" fill="#b9b6a6" />
    <circle cx="24.5" cy="17.2" r="1.5" fill="#5fb84e" />
  </svg>
);

export const InfoIcon = ({ size = 32, style, className }: IconProps) => (
  <svg viewBox="0 0 32 32" style={box(size, style)} className={className} aria-hidden>
    <defs>
      <radialGradient id="in-ball" cx="0.35" cy="0.3" r="0.8">
        <stop offset="0" stopColor="#9fd0f7" />
        <stop offset="0.5" stopColor="#2f8ae0" />
        <stop offset="1" stopColor="#0f4f96" />
      </radialGradient>
    </defs>
    <circle cx="16" cy="16" r="13" fill="url(#in-ball)" stroke="#0d3f79" />
    <ellipse cx="12.5" cy="10.5" rx="6" ry="3.6" fill="#fff" opacity="0.35" />
    <circle cx="16" cy="9.6" r="1.9" fill="#fff" />
    <rect x="14.2" y="13.4" width="3.6" height="10.4" rx="1.6" fill="#fff" />
  </svg>
);

export const StartLogoIcon = ({ size = 18, style, className }: IconProps) => (
  <svg viewBox="0 0 32 32" style={box(size, style)} className={className} aria-hidden>
    <defs>
      <linearGradient id="wf-r" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stopColor="#ff8b7a" />
        <stop offset="1" stopColor="#e33b26" />
      </linearGradient>
      <linearGradient id="wf-g" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stopColor="#a6e48f" />
        <stop offset="1" stopColor="#3f9c2c" />
      </linearGradient>
      <linearGradient id="wf-b" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stopColor="#8ecbf7" />
        <stop offset="1" stopColor="#1a70c8" />
      </linearGradient>
      <linearGradient id="wf-y" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stopColor="#ffe694" />
        <stop offset="1" stopColor="#eeb318" />
      </linearGradient>
    </defs>
    {/* the flag waves: the top edge curves up, the bottom sags */}
    <path d="M2.5 7.2 14 4.6v10.6H2.5z" fill="url(#wf-r)" />
    <path d="M15.6 4.3 30 1.6v13.6H15.6z" fill="url(#wf-g)" />
    <path d="M2.5 16.8H14v10.6L2.5 25z" fill="url(#wf-b)" />
    <path d="M15.6 16.8H30v13.6l-14.4-2.7z" fill="url(#wf-y)" />
  </svg>
);

/* ---- Notification area ----------------------------------------------------
 * 16px, and drawn for 16px: no gradient survives being squeezed into a third of
 * the space it was designed for, so these are flatter than the icons above on
 * purpose.
 */

export const VolumeIcon = ({ size = 16, style, className }: IconProps) => (
  <svg viewBox="0 0 16 16" style={box(size, style)} className={className} aria-hidden>
    <rect x="1" y="1" width="14" height="14" rx="2" fill="#1666bd" stroke="#0c4d8a" strokeWidth="0.8" />
    <path d="M4 6.5h2L8.5 4v8L6 9.5H4z" fill="#fff" />
    <path d="M10 5.6a3.6 3.6 0 0 1 0 4.8M11.8 4a6 6 0 0 1 0 8" stroke="#fff" strokeWidth="1.1" fill="none" strokeLinecap="round" />
  </svg>
);

export const NetworkIcon = ({ size = 16, style, className }: IconProps) => (
  <svg viewBox="0 0 16 16" style={box(size, style)} className={className} aria-hidden>
    <rect x="0.5" y="8" width="7" height="5" rx="1" fill="#d8dde3" stroke="#54646f" strokeWidth="0.8" />
    <rect x="8.5" y="3" width="7" height="5" rx="1" fill="#d8dde3" stroke="#54646f" strokeWidth="0.8" />
    <path d="M4 8V6h8" stroke="#54646f" strokeWidth="0.9" fill="none" />
    <circle cx="2.4" cy="10.5" r="0.8" fill="#4caf50" />
    <circle cx="10.4" cy="5.5" r="0.8" fill="#4caf50" />
  </svg>
);

export const ShieldIcon = ({ size = 16, style, className }: IconProps) => (
  <svg viewBox="0 0 16 16" style={box(size, style)} className={className} aria-hidden>
    <path d="M8 1.2 14 3.4v4.4c0 3.4-2.5 6-6 7.1-3.5-1.1-6-3.7-6-7.1V3.4z" fill="#d33a2a" stroke="#8f2418" strokeWidth="0.8" />
    <path d="M8 1.2 14 3.4v4.4c0 1.4-.4 2.7-1.2 3.7H8z" fill="#f0d23a" opacity="0.9" />
    <path d="M5.2 8.2 7.2 10.2l4-4.4" stroke="#fff" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ShowDesktopIcon = ({ size = 16, style, className }: IconProps) => (
  <svg viewBox="0 0 16 16" style={box(size, style)} className={className} aria-hidden>
    <rect x="1.5" y="2.5" width="13" height="9" rx="1" fill="#3f8ad8" stroke="#0c4d8a" strokeWidth="0.9" />
    <path d="M1.5 2.5h13v4.2c-4.4 1.3-8.6 1.3-13 0z" fill="#fff" opacity="0.25" />
    <path d="M8 13.4 5.4 10.4h5.2z" fill="#fff" stroke="#0c4d8a" strokeWidth="0.6" />
  </svg>
);

/* ---- Start menu -----------------------------------------------------------
 * Drawn for 24px: the right column of the Start menu is the densest place these
 * appear, and anything fussier than two shapes turns to mud there.
 */

export const DocumentsIcon = ({ size = 24, style, className }: IconProps) => (
  <svg viewBox="0 0 24 24" style={box(size, style)} className={className} aria-hidden>
    <defs>
      <linearGradient id="dc-f" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#ffe08a" />
        <stop offset="1" stopColor="#e5a327" />
      </linearGradient>
    </defs>
    <path d="M2 5h7l2 2.5h11V20H2z" fill="url(#dc-f)" stroke="#a8741a" strokeWidth="0.8" />
    <rect x="7" y="2.5" width="10" height="9" fill="#fff" stroke="#8e9aa6" strokeWidth="0.8" />
    <path d="M9 5h6M9 7h6M9 9h4" stroke="#9fb0c0" strokeWidth="0.9" strokeLinecap="round" />
    <path d="M2 9h20l-2 11H4z" fill="#ffd97a" stroke="#a8741a" strokeWidth="0.8" />
  </svg>
);

export const ControlPanelIcon = ({ size = 24, style, className }: IconProps) => (
  <svg viewBox="0 0 24 24" style={box(size, style)} className={className} aria-hidden>
    <rect x="2" y="4" width="20" height="15" rx="2" fill="#e9eef5" stroke="#6b7d8c" strokeWidth="0.9" />
    <rect x="4" y="6.5" width="7" height="4" rx="1" fill="#3a8de0" />
    <rect x="13" y="6.5" width="7" height="4" rx="1" fill="#5fb84e" />
    <rect x="4" y="12.5" width="7" height="4" rx="1" fill="#f0b429" />
    <rect x="13" y="12.5" width="7" height="4" rx="1" fill="#d9534f" />
  </svg>
);

export const HelpIcon = ({ size = 24, style, className }: IconProps) => (
  <svg viewBox="0 0 24 24" style={box(size, style)} className={className} aria-hidden>
    <circle cx="12" cy="12" r="9.5" fill="#3a8de0" stroke="#14508f" strokeWidth="0.9" />
    <ellipse cx="9.5" cy="7.6" rx="4.4" ry="2.6" fill="#fff" opacity="0.3" />
    <path
      d="M9.4 9.4a2.7 2.7 0 1 1 3.6 2.5c-.7.3-1 .9-1 1.7v.5"
      stroke="#fff"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
    />
    <circle cx="12" cy="17" r="1.3" fill="#fff" />
  </svg>
);

export const SearchIcon = ({ size = 24, style, className }: IconProps) => (
  <svg viewBox="0 0 24 24" style={box(size, style)} className={className} aria-hidden>
    <circle cx="10" cy="10" r="6" fill="#cfe6fb" stroke="#2f6cbf" strokeWidth="1.6" />
    <ellipse cx="8.2" cy="7.8" rx="2.6" ry="1.6" fill="#fff" opacity="0.8" />
    <path d="m14.6 14.6 5.2 5.2" stroke="#4a4a4a" strokeWidth="2.6" strokeLinecap="round" />
  </svg>
);

export const RunIcon = ({ size = 24, style, className }: IconProps) => (
  <svg viewBox="0 0 24 24" style={box(size, style)} className={className} aria-hidden>
    <rect x="2.5" y="4.5" width="19" height="14" rx="1.5" fill="#e9eef5" stroke="#6b7d8c" strokeWidth="0.9" />
    <rect x="2.5" y="4.5" width="19" height="3.4" fill="#3a8de0" />
    <path d="M5.5 11.5 8 13.8l-2.5 2.3" stroke="#2f6cbf" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    <path d="M9.8 16.2h6" stroke="#2f6cbf" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

export const LogOffIcon = ({ size = 20, style, className }: IconProps) => (
  <svg viewBox="0 0 24 24" style={box(size, style)} className={className} aria-hidden>
    <circle cx="12" cy="12" r="9.5" fill="#e9a33a" stroke="#a86c14" strokeWidth="0.9" />
    <path d="M12 5.5v6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M7.8 8a5.6 5.6 0 1 0 8.4 0" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" />
  </svg>
);

export const ShutdownIcon = ({ size = 20, style, className }: IconProps) => (
  <svg viewBox="0 0 24 24" style={box(size, style)} className={className} aria-hidden>
    <circle cx="12" cy="12" r="9.5" fill="#d9534f" stroke="#8f2418" strokeWidth="0.9" />
    <path d="M12 5.5v6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M7.8 8a5.6 5.6 0 1 0 8.4 0" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" />
  </svg>
);

export const IEIcon = ({ size = 16, style, className }: IconProps) => (
  <svg viewBox="0 0 16 16" style={box(size, style)} className={className} aria-hidden>
    <defs>
      <radialGradient id="ie-globe" cx="0.35" cy="0.3" r="0.85">
        <stop offset="0" stopColor="#bfe4ff" />
        <stop offset="0.55" stopColor="#3a92e0" />
        <stop offset="1" stopColor="#14508f" />
      </radialGradient>
    </defs>
    <circle cx="8" cy="8.4" r="5.6" fill="url(#ie-globe)" stroke="#0d3f79" strokeWidth="0.8" />
    <path d="M2.6 8.4h10.8M8 2.8c2.6 2.8 2.6 8.4 0 11.2M8 2.8c-2.6 2.8-2.6 8.4 0 11.2" stroke="#e8f4ff" strokeWidth="0.7" fill="none" opacity="0.8" />
    <path d="M1.6 11.2c3.4 1.8 9.6 1.4 13-1.4 1.4-1.2 1.2-2.6-.6-2.2" stroke="#e9b528" strokeWidth="2" fill="none" strokeLinecap="round" />
  </svg>
);
