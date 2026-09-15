import { useEffect, useMemo, useState } from "react";
import { blobUrlFor, listEntries, useFsStore, type FsEntry } from "../store/fsStore";
import { useWindowStore } from "../store/windowStore";
import { basename, dirname, display, normalize } from "../fs/path";
import { entryBytes, formatBytes } from "../fs/icons";
import { MenuBar } from "../components/MenuBar";
import styles from "./ImageViewer.module.css";

type Props = { path?: string; windowId?: string };

const isImage = (e: FsEntry) => e.kind === "file" && (e.mime?.startsWith("image/") ?? false);

/* The smallest thing that makes binary files mean something: somewhere to look
 * at one. Without it, an imported PNG is a row in a list that nothing can open.
 *
 * Previous and Next walk the folder the picture came from, which is what the
 * two arrows at the bottom of Windows Picture and Fax Viewer did - and what
 * turns a folder of photographs into something you can flip through without
 * going back to Explorer for each one.
 */
export function ImageViewer({ path, windowId }: Props) {
  const entries = useFsStore((s) => s.entries);
  const setTitle = useWindowStore((s) => s.setTitle);
  const [current, setCurrent] = useState<string | null>(path ? normalize(path) : null);
  const [actualSize, setActualSize] = useState(false);

  const entry = current ? entries[current] : undefined;
  const url = entry ? blobUrlFor(entry) : undefined;
  const name = entry ? basename(entry.path) : "";

  const siblings = useMemo(
    () => (current ? listEntries(entries, dirname(current)).filter(isImage) : []),
    [entries, current]
  );
  const index = siblings.findIndex((e) => e.path === current);
  const canPrev = index > 0;
  const canNext = index >= 0 && index < siblings.length - 1;

  const step = (delta: number) => {
    const next = siblings[index + delta];
    if (next) setCurrent(next.path);
  };

  useEffect(() => {
    if (windowId) setTitle(windowId, `${name || "No image"} - Windows Picture Viewer`);
  }, [windowId, name, setTitle]);

  return (
    <div
      className={styles.app}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") step(-1);
        if (e.key === "ArrowRight") step(1);
      }}
    >
      <MenuBar
        menus={[
          {
            label: "View",
            items: [
              { label: "Fit to Window", onClick: () => setActualSize(false) },
              { label: "Actual Size", onClick: () => setActualSize(true) },
              { label: "Previous Image", onClick: () => step(-1) },
              { label: "Next Image", onClick: () => step(1) },
            ],
          },
        ]}
      />

      <div className={styles.stage}>
        {url ? (
          <img src={url} alt={name} className={actualSize ? styles.actual : styles.fit} />
        ) : (
          <div className={styles.empty}>
            {entry
              ? "This file has no image data."
              : path
                ? `${display(path)} was not found.`
                : "No image."}
          </div>
        )}
      </div>

      <div className={styles.controls}>
        <button type="button" className={styles.navButton} disabled={!canPrev} onClick={() => step(-1)} aria-label="Previous Image">
          ◀
        </button>
        <span className={styles.counter}>
          {siblings.length > 0 && index >= 0 ? `${index + 1} of ${siblings.length}` : ""}
        </span>
        <button type="button" className={styles.navButton} disabled={!canNext} onClick={() => step(1)} aria-label="Next Image">
          ▶
        </button>
        <span className={styles.spacer} />
        <button type="button" className={styles.navButton} onClick={() => setActualSize(false)} title="Best Fit">
          ⊡
        </button>
        <button type="button" className={styles.navButton} onClick={() => setActualSize(true)} title="Actual Size">
          1:1
        </button>
      </div>

      <div className={styles.status}>
        <span>{entry ? display(entry.path) : ""}</span>
        <span>
          {entry ? formatBytes(entryBytes(entry)) : ""}
          {entry?.mime ? ` — ${entry.mime}` : ""}
        </span>
      </div>
    </div>
  );
}
