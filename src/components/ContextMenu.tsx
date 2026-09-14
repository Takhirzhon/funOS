import { useCallback, useEffect, useState } from "react";
import { useMenuStore, type MenuItem } from "../store/menuStore";
import styles from "./ContextMenu.module.css";

/* The single context menu for the whole desktop. Mounted once in App, so it
 * renders above every window regardless of z-index and cannot be clipped by
 * whatever opened it.
 */
export function ContextMenu() {
  const items = useMenuStore((s) => s.items);
  const x = useMenuStore((s) => s.x);
  const y = useMenuStore((s) => s.y);
  const close = useMenuStore((s) => s.close);

  useEffect(() => {
    if (!items) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    /* mousedown, not click: a menu that survives until mouseup can be dragged
     * through, which is how you accidentally invoke the item under the cursor
     * when you meant to dismiss.
     */
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("blur", close);
    };
  }, [items, close]);

  if (!items) return null;

  return <Panel items={items} x={x} y={y} onPick={close} />;
}

type PanelProps = {
  items: MenuItem[];
  x: number;
  y: number;
  onPick: () => void;
};

function Panel({ items, x, y, onPick }: PanelProps) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [openSub, setOpenSub] = useState<number | null>(null);
  const [subOrigin, setSubOrigin] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  /* Flip rather than overflow. Measured in a ref callback, which runs once the
   * node is in the DOM and is not an effect - the size of the menu is not known
   * until it has been laid out, and a menu half off the bottom of the screen is
   * the classic way this goes wrong on a right-click near the taskbar.
   */
  const measure = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const next = {
        x: x + rect.width > window.innerWidth ? Math.max(0, x - rect.width) : x,
        y: y + rect.height > window.innerHeight ? Math.max(0, y - rect.height) : y,
      };
      setPos((prev) => (prev && prev.x === next.x && prev.y === next.y ? prev : next));
    },
    [x, y]
  );

  return (
    <div
      ref={measure}
      className={styles.menu}
      style={{
        left: pos?.x ?? x,
        top: pos?.y ?? y,
        /* Hidden for the single frame between first layout and the flip, so a
         * menu opened near an edge never visibly jumps. */
        visibility: pos ? "visible" : "hidden",
      }}
      /* The dismissal listener is on mousedown, so without this every click on
       * the menu would close it before the item's own handler ever ran. */
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      role="menu"
    >
      {items.map((item, index) => {
        if (item.kind === "separator") {
          return <div key={`sep-${index}`} className={styles.separator} />;
        }

        const classes = [styles.item];
        if (item.disabled) classes.push(styles.disabled);
        if (item.bold) classes.push(styles.bold);
        if (openSub === index) classes.push(styles.hovered);

        return (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            className={classes.join(" ")}
            disabled={item.disabled}
            onMouseEnter={(e) => {
              if (item.submenu && !item.disabled) {
                const rect = e.currentTarget.getBoundingClientRect();
                setSubOrigin({ x: rect.right - 3, y: rect.top - 3 });
                setOpenSub(index);
              } else {
                setOpenSub(null);
              }
            }}
            onClick={() => {
              if (item.disabled || item.submenu) return;
              item.onClick?.();
              onPick();
            }}
          >
            <span className={styles.gutter}>{item.icon}</span>
            <span className={styles.label}>{item.label}</span>
            {item.submenu && <span className={styles.arrow}>▶</span>}
          </button>
        );
      })}

      {openSub !== null &&
        (() => {
          const parent = items[openSub];
          if (parent.kind !== "item" || !parent.submenu) return null;
          return (
            <Panel items={parent.submenu} x={subOrigin.x} y={subOrigin.y} onPick={onPick} />
          );
        })()}
    </div>
  );
}
