import { blobUrlFor, useFsStore } from "../store/fsStore";
import { basename, display } from "../fs/path";
import { entryBytes, formatBytes } from "../fs/icons";
import { MenuBar } from "../components/MenuBar";
import styles from "./PdfReader.module.css";

type Props = { path?: string };

/* A PDF, in a window.
 *
 * The browser already renders PDFs - Chrome natively, Firefox with pdf.js -
 * and an iframe is all it takes to borrow that. Shipping a renderer of our own
 * would be 400KB gzipped for a worse copy of what the visitor already has.
 *
 * The exceptions are on phones: iOS shows the first page and stops. Hence the
 * toolbar - "Open" hands the file to the browser proper, and "Save" is the
 * download, which on a CV is the button that actually matters.
 */
export function PdfReader({ path }: Props) {
  const entries = useFsStore((s) => s.entries);
  const entry = path ? entries[path] : undefined;
  const url = entry ? blobUrlFor(entry) : undefined;
  const name = entry ? basename(entry.path) : "";

  const openInBrowser = () => {
    if (url) window.open(url, "_blank", "noopener");
  };

  const download = () => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
  };

  return (
    <div className={styles.app}>
      <MenuBar
        menus={[
          {
            label: "File",
            items: [
              { label: "Open in Browser", onClick: openInBrowser },
              { label: "Save a Copy...", onClick: download },
            ],
          },
        ]}
      />

      <div className={styles.bar}>
        <span className={styles.grip} />
        <button type="button" className={styles.toolButton} disabled={!url} onClick={download}>
          Save a Copy
        </button>
        <button type="button" className={styles.toolButton} disabled={!url} onClick={openInBrowser}>
          Open in Browser
        </button>
      </div>

      <div className={styles.stage}>
        {url ? (
          <iframe title={name} src={url} className={styles.frame} />
        ) : (
          <div className={styles.empty}>
            {path ? `${display(path)} was not found.` : "No document."}
          </div>
        )}
      </div>

      <div className={styles.status}>
        <span>{entry ? display(entry.path) : ""}</span>
        <span>{entry ? formatBytes(entryBytes(entry)) : ""}</span>
      </div>
    </div>
  );
}
