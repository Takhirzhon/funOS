import type { CSSProperties } from "react";

type IconProps = { size?: number; style?: CSSProperties };

const wrap = (size: number, style?: CSSProperties): CSSProperties => ({
  width: size,
  height: size,
  display: "inline-block",
  verticalAlign: "middle",
  imageRendering: "pixelated",
  ...style,
});

export const MyComputerIcon = ({ size = 32, style }: IconProps) => (
  <svg viewBox="0 0 32 32" style={wrap(size, style)} aria-hidden>
    <rect x="3" y="6" width="26" height="17" rx="1" fill="#dcdcd4" stroke="#5a5a5a" />
    <rect x="5" y="8" width="22" height="13" fill="#7fbef0" />
    <rect x="5" y="8" width="22" height="13" fill="url(#gloss)" opacity="0.4" />
    <rect x="10" y="23" width="12" height="3" fill="#bdbdb3" stroke="#5a5a5a" />
    <rect x="6" y="26" width="20" height="3" rx="1" fill="#dcdcd4" stroke="#5a5a5a" />
    <circle cx="9" cy="27.5" r="0.8" fill="#3a3a3a" />
    <defs>
      <linearGradient id="gloss" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0.7" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
    </defs>
  </svg>
);

export const RecycleBinIcon = ({ size = 32, style }: IconProps) => (
  <svg viewBox="0 0 32 32" style={wrap(size, style)} aria-hidden>
    <path d="M7 9 L9 28 H23 L25 9 Z" fill="#c9c9c2" stroke="#5a5a5a" />
    <rect x="6" y="6" width="20" height="3" rx="1" fill="#dcdcd4" stroke="#5a5a5a" />
    <rect x="13" y="4" width="6" height="2" rx="0.5" fill="#dcdcd4" stroke="#5a5a5a" />
    <line x1="12" y1="12" x2="13" y2="25" stroke="#5a5a5a" />
    <line x1="16" y1="12" x2="16" y2="25" stroke="#5a5a5a" />
    <line x1="20" y1="12" x2="19" y2="25" stroke="#5a5a5a" />
  </svg>
);

export const NotepadIcon = ({ size = 32, style }: IconProps) => (
  <svg viewBox="0 0 32 32" style={wrap(size, style)} aria-hidden>
    <rect x="6" y="3" width="20" height="26" fill="#fff" stroke="#5a5a5a" />
    <rect x="6" y="3" width="20" height="4" fill="#dcdcd4" stroke="#5a5a5a" />
    <line x1="9" y1="12" x2="23" y2="12" stroke="#a0a0a0" />
    <line x1="9" y1="16" x2="23" y2="16" stroke="#a0a0a0" />
    <line x1="9" y1="20" x2="23" y2="20" stroke="#a0a0a0" />
    <line x1="9" y1="24" x2="19" y2="24" stroke="#a0a0a0" />
  </svg>
);

export const InfoIcon = ({ size = 32, style }: IconProps) => (
  <svg viewBox="0 0 32 32" style={wrap(size, style)} aria-hidden>
    <circle cx="16" cy="16" r="13" fill="#3a8de0" stroke="#1c4f8a" />
    <text
      x="16"
      y="22"
      fontSize="18"
      fontFamily="Georgia, serif"
      fontWeight="bold"
      textAnchor="middle"
      fill="#fff"
    >
      i
    </text>
  </svg>
);

export const StartLogoIcon = ({ size = 18, style }: IconProps) => (
  <svg viewBox="0 0 32 32" style={wrap(size, style)} aria-hidden>
    <path d="M2 6 L14 4 L14 15 L2 15 Z" fill="#f04a3a" />
    <path d="M16 4 L30 2 L30 15 L16 15 Z" fill="#5fb84e" />
    <path d="M2 17 L14 17 L14 28 L2 26 Z" fill="#3a8de0" />
    <path d="M16 17 L30 17 L30 30 L16 28 Z" fill="#f7c945" />
  </svg>
);
