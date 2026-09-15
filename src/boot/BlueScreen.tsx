import { useEffect, useState } from "react";
import { useSessionStore } from "../store/sessionStore";
import styles from "./BlueScreen.module.css";

/* The blue screen. Word for word, because everyone who saw it read it
 * several times while waiting for the memory dump, and a paraphrase would
 * be the one thing on this desktop that was not XP.
 *
 * The dump counts to 100 over a few seconds - the real one took longer and
 * nobody wants that back - and then any key reboots into the boot screen,
 * which is also what the real one did if you were lucky.
 */

const DUMP_MS = 3200;

export function BlueScreen() {
  const stop = useSessionStore((s) => s.stop);
  const restart = useSessionStore((s) => s.restart);
  const [progress, setProgress] = useState(0);
  const done = progress >= 100;

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const p = Math.min(100, Math.floor(((performance.now() - start) / DUMP_MS) * 100));
      setProgress(p);
      if (p < 100) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!done) return;
    const onKey = () => restart();
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onKey);
    };
  }, [done, restart]);

  return (
    <div className={styles.screen} role="alert">
      <pre className={styles.text}>
        {`A problem has been detected and Windows has been shut down to prevent damage
to your computer.

${stop.name}

If this is the first time you've seen this Stop error screen,
restart your computer. If this screen appears again, follow
these steps:

Check to make sure any new hardware or software is properly installed.
If this is a new installation, ask your hardware or software manufacturer
for any Windows updates you might need.

If problems continue, disable or remove any newly installed hardware
or software. Disable BIOS memory options such as caching or shadowing.
If you need to use Safe Mode to remove or disable components, restart
your computer, press F8 to select Advanced Startup Options, and then
select Safe Mode.

Technical information:

*** STOP: ${stop.code} ${stop.params}


Beginning dump of physical memory
`}
        {done
          ? `Physical memory dump complete.
Contact your system administrator or technical support group for further
assistance.

Press any key to restart.`
          : `Dumping physical memory to disk:  ${progress}`}
      </pre>
    </div>
  );
}
