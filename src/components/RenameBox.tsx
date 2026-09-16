import { useEffect, useRef } from "react";
import styles from "./RenameBox.module.css";

type Props = {
  value: string;
  /** Called once, with whatever is in the box, on Enter or when focus leaves. */
  onCommit: (name: string) => void;
  /** Escape. The box goes away and the name stays. */
  onCancel: () => void;
  /** The desktop's box wraps and is centred; Explorer's is one line. */
  centered?: boolean;
};

/* The edit box that appears over a name: white, black hairline, the whole
 * name selected. Every pointer and keyboard event stops here, because the
 * things underneath it - the icon, the desktop, the shortcut handlers -
 * would otherwise treat a click in the box as a click on the icon and a
 * Delete in the box as a delete of the file.
 */
export function RenameBox({ value, onCommit, onCancel, centered }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  const finish = (commit: boolean) => {
    if (done.current) return;
    done.current = true;
    if (commit) onCommit(ref.current?.value ?? value);
    else onCancel();
  };

  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

  return (
    <input
      ref={ref}
      className={centered ? `${styles.box} ${styles.centered}` : styles.box}
      defaultValue={value}
      spellCheck={false}
      autoComplete="off"
      aria-label="New name"
      size={Math.max(4, Math.min(40, value.length + 2))}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          finish(true);
        } else if (e.key === "Escape") {
          e.preventDefault();
          finish(false);
        }
      }}
      onBlur={() => finish(true)}
      onPointerDown={stop}
      onMouseDown={stop}
      onClick={stop}
      onDoubleClick={stop}
      onContextMenu={stop}
      onDragStart={(e) => e.preventDefault()}
    />
  );
}
