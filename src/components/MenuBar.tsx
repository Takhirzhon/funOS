import { useEffect, useState } from "react";
import { playSound } from "../store/soundStore";
import styles from "./MenuBar.module.css";

export type MenuBarItem = { label: string; onClick: () => void; disabled?: boolean };
export type MenuBarMenu = { label: string; items: MenuBarItem[] };

export function MenuBar({ menus }: { menus: MenuBarMenu[] }) {
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      className={styles.bar}
      /* The bar is not a drag handle - react-rnd only listens on .title-bar -
       * but the dismissal listener above is on mousedown, so without this the
       * menu would close before any item could be clicked. */
      onMouseDown={(e) => e.stopPropagation()}
    >
      {menus.map((menu) => (
        <div key={menu.label} className={styles.titleWrap}>
          <button
            type="button"
            className={open === menu.label ? `${styles.title} ${styles.open}` : styles.title}
            onClick={() => {
              if (open !== menu.label) playSound("menu");
              setOpen(open === menu.label ? null : menu.label);
            }}
            /* Once one menu is open, sliding across the bar opens the others
             * without another click - the behaviour every desktop menu has and
             * that people use without noticing. */
            onMouseEnter={() => open && setOpen(menu.label)}
          >
            {menu.label}
          </button>

          {open === menu.label && (
            <div className={styles.dropdown}>
              {menu.items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className={styles.item}
                  disabled={item.disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(null);
                    item.onClick();
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
