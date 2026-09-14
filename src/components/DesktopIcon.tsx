import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import styles from "./DesktopIcon.module.css";

type Props = {
  label: string;
  icon: ReactNode;
  selected: boolean;
  /** Absolute position within the icon field, in pixels. */
  x: number;
  y: number;
  dragging: boolean;
  onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  onContextMenu: (e: ReactMouseEvent<HTMLButtonElement>) => void;
  onOpen: () => void;
};

/* Selection and position are props, not local state.
 *
 * Selection used to be `useState` per icon, cleared on blur - which meant two
 * icons could both look selected (blur does not fire when the click lands on
 * the desktop) and the desktop had no way to clear them. Exactly one thing owns
 * the selection now, and the same goes for where each icon sits.
 */
export function DesktopIcon({
  label,
  icon,
  selected,
  x,
  y,
  dragging,
  onPointerDown,
  onContextMenu,
  onOpen,
}: Props) {
  const classes = [styles.icon];
  if (selected) classes.push(styles.selected);
  if (dragging) classes.push(styles.dragging);

  return (
    <button
      type="button"
      className={classes.join(" ")}
      style={{ transform: `translate(${x}px, ${y}px)` }}
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
    >
      <span className={styles.glyph}>{icon}</span>
      <span className={styles.label}>{label}</span>
    </button>
  );
}
