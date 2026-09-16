import { useMemo, useState, type FormEvent } from "react";
import { useFsStore, type FsEntry } from "../store/fsStore";
import { useWindowStore } from "../store/windowStore";
import { launchFile } from "../fs/open";
import { entryBytes, entryIcon, entryType } from "../fs/icons";
import { basename, dirname, display, isInside } from "../fs/path";
import { DESKTOP_DIR, HOME, MY_DOCUMENTS } from "../fs/seed";
import { DRIVE } from "../fs/path";
import { SearchIcon } from "../icons";
import { useMediaQuery, COARSE } from "../hooks/useMediaQuery";
import styles from "./Search.module.css";

/* Search Results - the Search Companion, minus the dog.
 *
 * The form down the left is XP's: all or part of the file name, a word or
 * phrase in the file, where to look. The results are Explorer's Details
 * view, because that is what they were. The search itself is a filter over
 * the whole file system, which at this size is instant; Windows' took long
 * enough that the dog had something to do.
 */

const PLACES: { path: string; label: string }[] = [
  { path: MY_DOCUMENTS, label: "My Documents" },
  { path: DESKTOP_DIR, label: "Desktop" },
  { path: HOME, label: "My Documents and the desktop (the profile)" },
  { path: DRIVE, label: "Local Disk (C:)" },
];

const sizeLabel = (entry: FsEntry) =>
  entry.kind === "dir" ? "" : `${Math.max(1, Math.ceil(entryBytes(entry) / 1024))} KB`;

export function Search() {
  const entries = useFsStore((s) => s.entries);
  const open = useWindowStore((s) => s.open);
  const coarse = useMediaQuery(COARSE);
  const [name, setName] = useState("");
  const [phrase, setPhrase] = useState("");
  const [place, setPlace] = useState(MY_DOCUMENTS);
  const [query, setQuery] = useState<{ name: string; phrase: string; place: string } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const results = useMemo(() => {
    if (!query) return [];
    const n = query.name.trim().toLowerCase();
    const p = query.phrase.trim().toLowerCase();
    if (!n && !p) return [];
    return Object.values(entries)
      .filter((e) => e.path !== query.place && (query.place === DRIVE || isInside(query.place, e.path)))
      .filter((e) => !n || basename(e.path).toLowerCase().includes(n))
      .filter((e) => !p || (e.kind === "file" && !e.bytes && !e.url && e.content.toLowerCase().includes(p)))
      .sort((a, b) => a.path.localeCompare(b.path));
  }, [entries, query]);

  const search = (e: FormEvent) => {
    e.preventDefault();
    setQuery({ name, phrase, place });
    setSelected(null);
  };

  const openResult = (entry: FsEntry) => {
    if (entry.kind === "dir") {
      open("explorer", { title: basename(entry.path), bounds: { width: 660, height: 460 }, props: { path: entry.path } });
    } else {
      launchFile(entry);
    }
  };

  return (
    <div className={styles.app}>
      <form className={styles.side} onSubmit={search}>
        <div className={styles.sideHead}>
          <SearchIcon size={22} /> Search Companion
        </div>
        <p className={styles.sideText}>Search by any or all of the criteria below.</p>

        <label className={styles.label} htmlFor="s-name">
          All or part of the file name:
        </label>
        <input id="s-name" className={styles.input} value={name} onChange={(e) => setName(e.target.value)} autoFocus />

        <label className={styles.label} htmlFor="s-phrase">
          A word or phrase in the file:
        </label>
        <input id="s-phrase" className={styles.input} value={phrase} onChange={(e) => setPhrase(e.target.value)} />

        <label className={styles.label} htmlFor="s-place">
          Look in:
        </label>
        <select id="s-place" className={styles.input} value={place} onChange={(e) => setPlace(e.target.value)}>
          {PLACES.map((p) => (
            <option key={p.path} value={p.path}>
              {p.label}
            </option>
          ))}
        </select>

        <div className={styles.buttons}>
          <button type="button" onClick={() => { setName(""); setPhrase(""); setQuery(null); }}>
            Back
          </button>
          <button type="submit">Search</button>
        </div>

        <p className={styles.sideText}>
          A word or phrase looks inside text files only. Pictures, clips and the PDF are found by name.
        </p>
      </form>

      <div className={styles.main}>
        <div className={styles.status}>
          {query === null
            ? "To start your search, follow the instructions in the left pane."
            : results.length === 0
              ? "Search is complete. There are no results to display."
              : `Search is complete. There are ${results.length} result${results.length === 1 ? "" : "s"}.`}
        </div>
        <div className={styles.list} onMouseDown={() => setSelected(null)}>
          <div className={styles.headerRow}>
            <span>Name</span>
            <span>In Folder</span>
            <span>Size</span>
            <span>Type</span>
          </div>
          {results.map((entry) => (
            <button
              key={entry.path}
              type="button"
              className={selected === entry.path ? `${styles.row} ${styles.selected}` : styles.row}
              onMouseDown={(e) => {
                e.stopPropagation();
                setSelected(entry.path);
              }}
              onDoubleClick={() => openResult(entry)}
              onClick={coarse ? () => openResult(entry) : undefined}
              title={display(entry.path)}
            >
              <span className={styles.cellName}>
                {entryIcon(entry, 16)}
                <span className={styles.ellipsis}>{basename(entry.path)}</span>
              </span>
              <span className={styles.ellipsis}>{display(dirname(entry.path))}</span>
              <span className={styles.cellSize}>{sizeLabel(entry)}</span>
              <span className={styles.ellipsis}>{entryType(entry)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
