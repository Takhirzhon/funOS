import type { ReactNode } from "react";
import styles from "./DesktopIcon.module.css";

type Props = {
  label: string;
  icon: ReactNode;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
};

/* Selection is a prop, not local state.
 *
 * It used to be `useState` per icon, cleared on blur, which meant two icons
 * could both look selected (blur does not fire when the click lands on the
 * desktop) and the desktop had no way to clear them. Exactly one thing is
 * selected at a time, so exactly one place should know which.
 */
export function DesktopIcon({ label, icon, selected, onSelect, onOpen }: Props) {
  return (
    <button
      type="button"
      className={selected ? `${styles.icon} ${styles.selected}` : styles.icon}
      onMouseDown={(e) => {
        e.stopPropagation();
        onSelect();
      }}
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
