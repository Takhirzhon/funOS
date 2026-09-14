import { useState } from "react";
import {
  SAVER_NAMES,
  THEME_NAMES,
  useThemeStore,
  type Saver,
  type Theme,
} from "../store/themeStore";
import { SaverCanvas } from "../components/ScreenSaver";
import styles from "./DisplayProperties.module.css";

type Tab = "themes" | "screensaver";

/* Display Properties - reached by right-clicking the desktop, which is where
 * XP put it and where everyone still looks for it.
 *
 * It is a window rather than a modal dialog on purpose: the preview is the
 * point of this thing, and a modal that dims the desktop would hide the very
 * change being previewed.
 */
export function DisplayProperties() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const saver = useThemeStore((s) => s.saver);
  const setSaver = useThemeStore((s) => s.setSaver);
  const idleMinutes = useThemeStore((s) => s.idleMinutes);
  const setIdleMinutes = useThemeStore((s) => s.setIdleMinutes);

  const [tab, setTab] = useState<Tab>("themes");
  /* Previewing a saver you have not chosen yet, without committing it - the
   * dropdown changes the preview immediately, which is how you pick one. */
  const [preview, setPreview] = useState<Saver>(saver);

  return (
    <div className={styles.app}>
      <div className={styles.tabs}>
        <button
          type="button"
          className={tab === "themes" ? `${styles.tab} ${styles.active}` : styles.tab}
          onClick={() => setTab("themes")}
        >
          Themes
        </button>
        <button
          type="button"
          className={tab === "screensaver" ? `${styles.tab} ${styles.active}` : styles.tab}
          onClick={() => setTab("screensaver")}
        >
          Screen Saver
        </button>
      </div>

      <div className={styles.page}>
        {tab === "themes" ? (
          <>
            <p className={styles.blurb}>
              A theme is a background plus a set of sounds, icons, and other elements to help
              you personalize your computer with one click.
            </p>

            <label className={styles.field}>
              <span>Theme:</span>
              <select value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
                {(Object.keys(THEME_NAMES) as Theme[]).map((id) => (
                  <option key={id} value={id}>
                    {THEME_NAMES[id]}
                  </option>
                ))}
              </select>
            </label>

            {/* No OK/Apply. The change lands the moment it is chosen, which is
                what makes it worth choosing - and there is nothing to cancel
                back to that is not one more click on the dropdown. */}
            <div className={styles.sample}>
              <div className={styles.sampleBar}>
                <span className={styles.sampleStart}>start</span>
                <span className={styles.sampleTray} />
              </div>
              <div className="window" style={{ margin: "10px auto", width: 200 }}>
                <div className="title-bar">
                  <div className="title-bar-text">Active window</div>
                  <div className="title-bar-controls">
                    <button aria-label="Close" />
                  </div>
                </div>
                <div className="window-body" style={{ padding: 8 }}>
                  <button type="button">Button</button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className={styles.monitor}>
              <SaverCanvas saver={preview} className={styles.monitorScreen} />
              <div className={styles.stand} />
            </div>

            <label className={styles.field}>
              <span>Screen saver:</span>
              <select
                value={preview}
                onChange={(e) => {
                  const next = e.target.value as Saver;
                  setPreview(next);
                  setSaver(next);
                }}
              >
                {(Object.keys(SAVER_NAMES) as Saver[]).map((id) => (
                  <option key={id} value={id}>
                    {SAVER_NAMES[id]}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>Wait:</span>
              <input
                type="number"
                min={1}
                max={60}
                value={idleMinutes}
                onChange={(e) => setIdleMinutes(Number(e.target.value))}
              />
              <span>minutes</span>
            </label>

            <p className={styles.blurb}>
              3D Maze is real 3D and downloads about 150KB the first time you pick it.
              Nothing else on this desktop pays for that — it is fetched only when
              chosen. Its brick and floor textures are drawn in code rather than
              downloaded.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
