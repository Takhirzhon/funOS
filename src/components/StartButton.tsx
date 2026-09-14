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
    </button>
  );
}
