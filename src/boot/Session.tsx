import { useEffect } from "react";
import { useSessionStore } from "../store/sessionStore";
import { StartLogoIcon } from "../icons";
import styles from "./Session.module.css";

const BOOT_MS = 2400;

export function BootScreen() {
  const finishBoot = useSessionStore((s) => s.finishBoot);

  useEffect(() => {
    const timer = setTimeout(finishBoot, BOOT_MS);
    return () => clearTimeout(timer);
  }, [finishBoot]);

  return (
    /* Clicking skips it. The boot screen is a period detail, not a toll booth,
     * and the reload that matters most is the one somebody does because
     * something broke. */
    <div className={styles.boot} onClick={finishBoot}>
      <div className={styles.logo}>
        <StartLogoIcon size={48} />
        <span className={styles.logoText}>
          funOS
          <small>PROFESSIONAL</small>
        </span>
      </div>

      <div className={styles.trough}>
        <div className={styles.blocks}>
          <span className={styles.block} />
          <span className={styles.block} />
          <span className={styles.block} />
        </div>
      </div>

      <span className={styles.hint}>Click to skip</span>
    </div>
  );
}

export function LoginScreen() {
  const logIn = useSessionStore((s) => s.logIn);

  /* Enter logs in too. The welcome screen with one account is a formality, and
   * making it reachable from the keyboard costs two lines. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") logIn();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [logIn]);

  return (
    <div className={styles.login}>
      <div className={styles.loginTop}>
        <div className={styles.loginBrand}>
          <strong>funOS</strong>
          <span>Professional</span>
        </div>
      </div>

      <div className={styles.loginBand}>
        <div className={styles.loginPrompt}>To begin, click your user name</div>
        <button type="button" className={styles.tile} onClick={logIn} autoFocus>
          <span className={styles.avatar}>U</span>
          <span className={styles.tileName}>User</span>
        </button>
      </div>

      <div className={styles.loginBottom}>
        <span>After you log on, you can add or change accounts.</span>
        <span>Press Enter to log on</span>
      </div>
    </div>
  );
}

export function TurnOffDialog() {
  const cancel = useSessionStore((s) => s.cancelTurnOff);
  const turnOff = useSessionStore((s) => s.turnOff);
  const restart = useSessionStore((s) => s.restart);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cancel]);

  return (
    <div className={styles.dim} onMouseDown={(e) => e.stopPropagation()}>
      <div className={styles.turnOff}>
        <div className={styles.turnOffHead}>Turn off computer</div>

        <div className={styles.turnOffBody}>
          {/* Stand By is disabled rather than missing. The three-button row is
              the shape people remember, and a greyed button is an honest "not
              built" where a two-button row is a silent one. */}
          <button type="button" className={styles.choice} disabled>
            <span className={styles.choiceIcon} style={{ background: "#d8a33a" }}>
              ☾
            </span>
            Stand By
          </button>

          <button type="button" className={styles.choice} onClick={turnOff}>
            <span className={styles.choiceIcon} style={{ background: "#d9534f" }}>
              ⏻
            </span>
            Turn Off
          </button>

          <button type="button" className={styles.choice} onClick={restart}>
            <span className={styles.choiceIcon} style={{ background: "#5aa84a" }}>
              ↻
            </span>
            Restart
          </button>
        </div>

        <div className={styles.turnOffFoot}>
          <button type="button" onClick={cancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function GoodbyeScreen() {
  const restart = useSessionStore((s) => s.restart);

  return (
    <div className={styles.goodbye}>
      <span>It is now safe to turn off your computer.</span>
      {/* A browser tab cannot actually be switched off, and pretending
          otherwise would leave a dead black page with no way back. */}
      <button type="button" className={styles.goodbyeAction} onClick={restart}>
        Turn it back on
      </button>
    </div>
  );
}
