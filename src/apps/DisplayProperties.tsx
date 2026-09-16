import { useMemo, useState } from "react";
import {
  FIT_NAMES,
  SAVER_NAMES,
  THEME_NAMES,
  useThemeStore,
  type Saver,
  type Theme,
  type Wallpaper,
  type WallpaperFit,
} from "../store/themeStore";
import { blobUrlFor, listEntries, useFsStore } from "../store/fsStore";
import { useWallpaperStyle } from "../store/wallpaper";
import { fileDialog } from "../store/dialogStore";
import { MY_DOCUMENTS } from "../fs/seed";
import { basename, join, normalize } from "../fs/path";
import { SaverCanvas } from "../components/ScreenSaver";
import { PictureIcon } from "../icons";
import styles from "./DisplayProperties.module.css";

type Tab = "themes" | "desktop" | "screensaver";

const PICTURES = join(MY_DOCUMENTS, "My Pictures");

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

  const wallpaper = useThemeStore((s) => s.wallpaper);
  const fit = useThemeStore((s) => s.fit);
  const setWallpaper = useThemeStore((s) => s.setWallpaper);
  const setFit = useThemeStore((s) => s.setFit);
  const entries = useFsStore((s) => s.entries);
  const wallpaperStyle = useWallpaperStyle();

  /* The pictures on offer: Bliss, nothing, and every image in My Pictures
   * (top level - the project screenshots are not wallpaper). A picture set
   * from anywhere else, via Browse or Explorer's menu, is listed while it is
   * the current one, so the list never shows nothing selected. */
  const choices = useMemo(() => {
    const list: { id: Wallpaper; label: string }[] = [
      { id: "none", label: "(None)" },
      { id: "bliss", label: "Bliss" },
      ...listEntries(entries, PICTURES)
        .filter((e) => e.mime?.startsWith("image/"))
        .map((e) => ({ id: e.path as Wallpaper, label: basename(e.path) })),
    ];
    if (wallpaper.startsWith("C:") && !list.some((c) => c.id === wallpaper) && entries[wallpaper]) {
      list.push({ id: wallpaper, label: basename(wallpaper) });
    }
    return list;
  }, [entries, wallpaper]);

  const browse = async () => {
    const picked = await fileDialog("open", PICTURES, "");
    if (picked === null) return;
    const entry = entries[normalize(picked)];
    if (entry?.mime?.startsWith("image/")) setWallpaper(entry.path as Wallpaper);
  };

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
          className={tab === "desktop" ? `${styles.tab} ${styles.active}` : styles.tab}
          onClick={() => setTab("desktop")}
        >
          Desktop
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
        {tab === "desktop" && (
          <>
            <div className={styles.monitor}>
              {/* The same style the desktop draws itself with, on the little
                  screen, over Bliss when there is nothing to override. */}
              <div className={`${styles.monitorScreen} ${styles.monitorBliss}`} style={wallpaperStyle} />
              <div className={styles.stand} />
            </div>

            <div className={styles.wallRow}>
              <div className={styles.wallList} role="listbox">
                {choices.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="option"
                    aria-selected={c.id === wallpaper}
                    className={c.id === wallpaper ? `${styles.wallItem} ${styles.wallCurrent}` : styles.wallItem}
                    onClick={() => setWallpaper(c.id)}
                  >
                    {c.id.startsWith("C:") ? (
                      <img
                        className={styles.wallSwatch}
                        src={entries[c.id]?.thumb ?? blobUrlFor(entries[c.id]!)}
                        alt=""
                      />
                    ) : c.id === "bliss" ? (
                      <PictureIcon size={16} />
                    ) : (
                      <span className={styles.wallNone} />
                    )}
                    <span className={styles.wallLabel}>{c.label}</span>
                  </button>
                ))}
              </div>
              <div className={styles.wallSide}>
                <button type="button" onClick={() => void browse()}>
                  Browse...
                </button>
                <label className={styles.field} style={{ marginBottom: 0 }}>
                  <span>Position:</span>
                  <select value={fit} onChange={(e) => setFit(e.target.value as WallpaperFit)}>
                    {(Object.keys(FIT_NAMES) as WallpaperFit[]).map((id) => (
                      <option key={id} value={id}>
                        {FIT_NAMES[id]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <p className={styles.blurb}>
              Any picture in My Pictures, or one you drop onto the desktop from your own computer.
              Right-click a picture anywhere and choose Set as Desktop Background.
            </p>
          </>
        )}
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
        ) : tab === "desktop" ? null : (
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
              3D Maze and 3D Text are real 3D and download about 150KB the first time
              you pick one. Nothing else on this desktop pays for that — it is fetched
              only when chosen. The bricks, the floor and the letters are drawn in code
              rather than downloaded.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
