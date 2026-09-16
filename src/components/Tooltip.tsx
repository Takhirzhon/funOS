import { useEffect, useState } from "react";
import styles from "./Tooltip.module.css";

/* The tooltip: pale yellow, black hairline, eight tenths of a second after
 * the pointer stops on something. One for the whole shell, listening for
 * anything with a `data-tip`, because the browser's own `title` draws the
 * host's tooltip in the host's style and on its own schedule, and a taskbar
 * button with a Windows tooltip and a Chrome one is two tooltips.
 *
 * It is drawn above the element it describes, which is where XP put the
 * taskbar's, and slides left when that would run off the screen.
 */

type Tip = { text: string; x: number; y: number };

const DELAY = 800;

export function Tooltip() {
  const [tip, setTip] = useState<Tip | null>(null);

  useEffect(() => {
    let timer: number | undefined;
    let host: HTMLElement | null = null;

    const hide = () => {
      window.clearTimeout(timer);
      host = null;
      setTip((t) => (t ? null : t));
    };

    const over = (e: MouseEvent) => {
      /* A finger does not hover; the tap's synthetic mouseover would put up
       * a tip that nothing then takes down. */
      if (window.matchMedia("(hover: none)").matches) return;
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-tip]") ?? null;
      if (el === host) return;
      hide();
      if (!el) return;
      host = el;
      timer = window.setTimeout(() => {
        const text = el.dataset.tip;
        if (!text || !el.isConnected) return;
        const r = el.getBoundingClientRect();
        setTip({ text, x: e.clientX, y: r.top });
      }, DELAY);
    };

    const out = (e: MouseEvent) => {
      const to = e.relatedTarget as HTMLElement | null;
      if (host && (!to || !host.contains(to))) hide();
    };

    document.addEventListener("mouseover", over);
    document.addEventListener("mouseout", out);
    /* A press hides it, as it does everywhere: the tip described what you
     * were about to do, and now you have done it. */
    document.addEventListener("mousedown", hide, true);
    document.addEventListener("keydown", hide, true);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mouseover", over);
      document.removeEventListener("mouseout", out);
      document.removeEventListener("mousedown", hide, true);
      document.removeEventListener("keydown", hide, true);
    };
  }, []);

  if (!tip) return null;
  /* Roughly how wide it will be: enough to keep it on screen before it has
   * been measured, which is the only frame that matters. */
  const width = Math.min(tip.text.length * 6 + 12, window.innerWidth - 8);
  const left = Math.max(4, Math.min(tip.x - 8, window.innerWidth - width - 4));
  return (
    <div className={styles.tip} style={{ left, bottom: window.innerHeight - tip.y + 6 }} role="tooltip">
      {tip.text}
    </div>
  );
}
