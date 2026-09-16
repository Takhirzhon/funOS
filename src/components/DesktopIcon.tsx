import type {
  DragEvent as ReactDragEvent,
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
  /** On the clipboard, waiting to be pasted somewhere else. */
  cut: boolean;
  /** Hidden, but shown because the folder option says so: drawn ghosted. */
  ghost?: boolean;
  onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  onContextMenu: (e: ReactMouseEvent<HTMLButtonElement>) => void;
  onOpen: () => void;
  /** A single tap, on a touch screen - where a double tap is a zoom. */
  onTap?: () => void;
  /** A folder path this icon accepts drops for - the Recycle Bin's, mostly. */
  dropPath?: string;
  /** Lit as a drop target, by either drag system. */
  dropTarget?: boolean;
  onDragOver?: (e: ReactDragEvent<HTMLButtonElement>) => void;
  onDragLeave?: (e: ReactDragEvent<HTMLButtonElement>) => void;
  onDrop?: (e: ReactDragEvent<HTMLButtonElement>) => void;
  /** A click that landed on the name itself, for click-pause-click renaming. */
  onLabelClick?: (e: ReactMouseEvent<HTMLSpanElement>) => void;
  /** The rename box, drawn where the name was. */
  editor?: ReactNode;
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
  cut,
  ghost,
  onPointerDown,
  onContextMenu,
  onOpen,
  onTap,
  dropPath,
  dropTarget,
  onDragOver,
  onDragLeave,
  onDrop,
  onLabelClick,
  editor,
}: Props) {
  const classes = [styles.icon];
  if (selected || dropTarget) classes.push(styles.selected);
  if (dragging) classes.push(styles.dragging);
  if (cut || ghost) classes.push(styles.cut);

  /* While the name is being edited the icon is a plain box around a text
   * field, not a button: a text field inside a button is not a thing a
   * browser has to support, and one of them does not. */
  if (editor) {
    return (
      <div className={`${classes.join(" ")} ${styles.editing}`} style={{ transform: `translate(${x}px, ${y}px)` }}>
        <span className={styles.glyph}>{icon}</span>
        {editor}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={classes.join(" ")}
      style={{ transform: `translate(${x}px, ${y}px)` }}
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
      onClick={onTap}
      data-drop-path={dropPath}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
    >
      <span className={styles.glyph}>{icon}</span>
      <span className={styles.label} onClick={onLabelClick}>
        {label}
      </span>
    </button>
  );
}
