import { useEffect, useState } from "react";
import { useSessionStore } from "../store/sessionStore";
import { RestartIcon, ShutdownIcon, StandByIcon, StartLogoIcon } from "../icons";
import styles from "./Session.module.css";

/* The account on the welcome screen. XP put a picture in the tile - the
 * chess pieces, the rubber duck, or your own - and this one is the owner's,
 * because the welcome screen is the first thing a visitor sees with a name
 * on it. The picture is a file under public/, not an import: at 2.5KB Vite
 * would inline it into the entry chunk as base64, which is the budgeted
 * half. The profile folder stays C:\Documents and Settings\User: XP named
 * the folder when the account was created and never renamed it afterwards,
 * and returning visitors have that tree in IndexedDB already. */
const ACCOUNT = { name: "Tokhirzhon", picture: "/account.webp" };

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
          <img src={ACCOUNT.picture} alt="" className={styles.avatar} width={54} height={54} draggable={false} />
          <span className={styles.tileName}>{ACCOUNT.name}</span>
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
            <StandByIcon size={46} className={styles.choiceIcon} />
            Stand By
          </button>

          <button type="button" className={styles.choice} onClick={turnOff}>
            <ShutdownIcon size={46} className={styles.choiceIcon} />
            Turn Off
          </button>

          <button type="button" className={styles.choice} onClick={restart}>
            <RestartIcon size={46} className={styles.choiceIcon} />
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
  /* "Windows is shutting down..." on the welcome screen's blue for as long
   * as the Exit Windows sound takes, and then the black screen. Turning off
   * was never instant, and the sound over a black screen with the "safe"
   * message already on it plays like it arrived late. */
  const [down, setDown] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setDown(true), 2400);
    return () => window.clearTimeout(t);
  }, []);

  if (!down) {
    return (
      <div className={`${styles.login} ${styles.shuttingDown}`}>
        <div className={styles.loginTop}>
          <div className={styles.loginBrand}>
            <strong>funOS</strong>
            <span>Professional</span>
          </div>
        </div>
        <div className={styles.loginBand}>
          <div className={styles.loginPrompt}>Windows is shutting down...</div>
        </div>
        <div className={styles.loginBottom} />
      </div>
    );
  }

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
