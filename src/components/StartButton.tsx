import { StartLogoIcon } from "../icons";
import styles from "./StartButton.module.css";

type Props = { open: boolean; onClick: () => void };

export function StartButton({ open, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={open}
      className={open ? `${styles.start} ${styles.open}` : styles.start}
    >
      <StartLogoIcon size={19} className={styles.logo} />
      start
      {/* The tooltip is drawn, not the browser's: a native `title` comes up
          in the host's style, which on this desktop is the wrong operating
          system. Hidden while the menu is open, since you have begun. */}
      {!open && (
        <span className={styles.tip} role="tooltip">
          Click here to begin
        </span>
      )}
    </button>
  );
}
