import type { CSSProperties } from "react";
import { useThemeStore, type WallpaperFit } from "./themeStore";
import { blobUrlFor, useFsStore } from "./fsStore";

/* The desktop's background, as a style.
 *
 * Bliss is the stylesheet's default and needs no style at all. Anything else
 * overrides it inline: nothing gives the Luna blue, a path gives the picture
 * at that path - by its URL if it is served, by a blob URL if it was dropped
 * in - fitted the way XP fitted it. A path whose file is gone falls back to
 * Bliss, so deleting the photograph you set as the background does not leave
 * a desktop with a broken image on it.
 */

const FIT: Record<WallpaperFit, CSSProperties> = {
  stretch: { backgroundSize: "cover", backgroundRepeat: "no-repeat", backgroundPosition: "center" },
  center: { backgroundSize: "auto", backgroundRepeat: "no-repeat", backgroundPosition: "center" },
  tile: { backgroundSize: "auto", backgroundRepeat: "repeat", backgroundPosition: "top left" },
};

export function useWallpaperStyle(): CSSProperties | undefined {
  const wallpaper = useThemeStore((s) => s.wallpaper);
  const fit = useThemeStore((s) => s.fit);
  const entry = useFsStore((s) => (wallpaper.startsWith("C:") ? s.entries[wallpaper] : undefined));

  if (wallpaper === "bliss") return undefined;
  if (wallpaper === "none") return { backgroundImage: "none", backgroundColor: "#3a6ea5" };
  const url = entry ? blobUrlFor(entry) : undefined;
  if (!url) return undefined;
  return { backgroundImage: `url("${url}")`, backgroundColor: "#3a6ea5", ...FIT[fit] };
}
