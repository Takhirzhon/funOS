import { useState } from "react";
import { blobUrlFor, useFsStore } from "../store/fsStore";
import { basename, display } from "../fs/path";
import { MenuBar } from "../components/MenuBar";
import styles from "./ImageViewer.module.css";

type Props = { path?: string };

/* The smallest thing that makes binary files mean something: somewhere to look
 * at one. Without it, an imported PNG is a row in a list that nothing can open.
 */
export function ImageViewer({ path }: Props) {
  const entries = useFsStore((s) => s.entries);
  const [actualSize, setActualSize] = useState(false);

  const entry = path ? entries[path] : undefined;
  const url = entry ? blobUrlFor(entry) : undefined;

  return (
    <div className={styles.app}>
      <MenuBar
        menus={[
          {
            label: "View",
            items: [
              { label: "Fit to Window", onClick: () => setActualSize(false) },
              { label: "Actual Size", onClick: () => setActualSize(true) },
            ],
          },
        ]}
      />

      <div className={styles.stage}>
        {url ? (
          <img
            src={url}
            alt={basename(entry?.path ?? "")}
            className={actualSize ? styles.actual : styles.fit}
          />
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

      <div className={styles.status}>
        <span>{entry ? display(entry.path) : ""}</span>
        <span>
          {entry?.bytes ? `${(entry.bytes.byteLength / 1024).toFixed(1)} KB` : ""}
          {entry?.mime ? ` — ${entry.mime}` : ""}
        </span>
      </div>
    </div>
  );
}
