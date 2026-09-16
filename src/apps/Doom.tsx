import { useEffect, useRef, useState } from "react";
import { useWindowStore } from "../store/windowStore";
import { useMediaQuery, COARSE } from "../hooks/useMediaQuery";
import styles from "./Doom.module.css";

/* DOOM. The 1995 shareware episode, DOOM.EXE and DOOM1.WAD as id shipped
 * them, running in DOSBox compiled to WebAssembly (js-dos 7). Nothing of
 * this is in the bundle: the emulator is two megabytes and the game another
 * two, both under /doom/ as plain files, fetched the first time the window
 * opens and cached by the browser after that.
 *
 * Keys go to the game while its window has focus and nowhere else - the
 * emulator binds them to its own element, not the document - which is what
 * lets Ctrl+Esc and the taskbar keep working with a marine mid-corridor.
 */

const PREFIX = "/doom/js-dos/";
const BUNDLE = "/doom/doom.jsdos";

type CommandInterface = {
  exit: () => Promise<void>;
  width: () => number;
  height: () => number;
  events: () => { onExit: (fn: () => void) => void; onFrameSize: (fn: (w: number, h: number) => void) => void };
};
type DosInstance = {
  run: (bundle: string) => Promise<CommandInterface>;
  stop: () => Promise<void>;
  enableMobileControls: () => Promise<void>;
  layers: { canvas: HTMLCanvasElement };
};
type DosWindow = Window & {
  emulators?: { pathPrefix: string };
  /** The on-screen keyboard js-dos brings along, which hooks the document. */
  SimpleKeyboardInstances?: Record<string, { destroy?: () => void } | undefined>;
  Dos?: (root: HTMLDivElement, options: { emulatorFunction: string; layersOptions?: { optionControls?: string[] } }) => DosInstance;
};

/* js-dos's on-screen keyboard (simple-keyboard) installs itself as
 * document.onpointerup with stopMouseUpPropagation on, and never lets go:
 * every pointerup on the page then stops at the document, and the desktop's
 * window listener - which ends an icon drag or a marquee - never hears it.
 * An icon glued to the pointer after a game of DOOM was that. The keyboard
 * is for touch screens; on anything else the hooks go, and on the way out
 * the instance is destroyed, which is what daedalOS does too. */
function unhookKeyboard(w: DosWindow, destroy: boolean) {
  if (destroy) {
    for (const kb of Object.values(w.SimpleKeyboardInstances ?? {})) {
      try {
        kb?.destroy?.();
      } catch {
        /* Already gone. */
      }
    }
  }
  document.onpointerup = null;
  document.onmouseup = null;
  document.ontouchend = null;
  document.ontouchcancel = null;
}

const loaded = new Map<string, Promise<void>>();

/** A script or stylesheet, once; the promise is shared by every caller. */
function load(url: string): Promise<void> {
  let p = loaded.get(url);
  if (!p) {
    p = new Promise<void>((resolve, reject) => {
      const el = url.endsWith(".css") ? document.createElement("link") : document.createElement("script");
      if (el instanceof HTMLLinkElement) {
        el.rel = "stylesheet";
        el.href = url;
      } else {
        el.src = url;
        el.async = true;
      }
      el.onload = () => resolve();
      el.onerror = () => reject(new Error(`Could not load ${url}`));
      document.head.appendChild(el);
    });
    loaded.set(url, p);
  }
  return p;
}

type Props = { windowId?: string };

export function Doom({ windowId }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const close = useWindowStore((s) => s.close);
  const coarse = useMediaQuery(COARSE);
  const [status, setStatus] = useState<"loading" | "running" | "failed">("loading");

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let dos: DosInstance | null = null;
    let ci: CommandInterface | null = null;
    let cancelled = false;

    (async () => {
      try {
        await load(`${PREFIX}emulators-ui.css`);
        await load(`${PREFIX}emulators.js`);
        await load(`${PREFIX}emulators-ui.js`);
        const w = window as DosWindow;
        if (cancelled || !w.emulators || !w.Dos) return;
        w.emulators.pathPrefix = PREFIX;
        /* No gear button over the screen: its menu is js-dos's, not ours. */
        dos = w.Dos(root, { emulatorFunction: "dosboxWorker", layersOptions: { optionControls: [] } });
        ci = await dos.run(BUNDLE);
        if (cancelled) {
          void ci.exit();
          return;
        }
        setStatus("running");
        /* Typing EXIT at the prompt, or quitting DOOM, closes the window. */
        ci.events().onExit(() => {
          if (windowId) close(windowId);
        });
        if (coarse) void dos.enableMobileControls();
        else unhookKeyboard(w, false);
        root.focus({ preventScroll: true });
      } catch {
        if (!cancelled) setStatus("failed");
      }
    })();

    return () => {
      cancelled = true;
      void dos?.stop();
      void ci?.exit();
      unhookKeyboard(window as DosWindow, true);
    };
    /* The instance lives as long as the window; the touch controls are
     * decided when it starts. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.app} onMouseDown={() => rootRef.current?.focus({ preventScroll: true })}>
      <div ref={rootRef} className={styles.screen} tabIndex={0} />
      {status === "loading" && (
        <div className={styles.note}>Loading DOOM - the emulator and the game are about four megabytes the first time...</div>
      )}
      {status === "failed" && (
        <div className={styles.note}>DOOM could not be started. The emulator did not load; try again with the network on.</div>
      )}
      {status === "running" && !coarse && (
        <div className={styles.hint}>Arrows move, Ctrl fires, Space opens doors, Esc is the menu. Click the screen to lock the mouse.</div>
      )}
    </div>
  );
}
