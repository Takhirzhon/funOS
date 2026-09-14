import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDialogStore, type DialogRequest } from "../store/dialogStore";
import { listEntries, useFsStore, type FsEntry } from "../store/fsStore";
import { basename, dirname, display, isDriveRoot, join, normalize } from "../fs/path";
import { entryBytes, entryIcon, entryType, formatBytes } from "../fs/icons";
import { HelpIcon, InfoIcon, ShutdownIcon } from "../icons";
import styles from "./Dialog.module.css";

/* The one modal dialog, mounted once in App next to the context menu. */
export function Dialog() {
  const request = useDialogStore((s) => s.request);
  const seq = useDialogStore((s) => s.seq);
  const close = useDialogStore((s) => s.close);

  useEffect(() => {
    if (!request) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      /* Cancelling is never `true`, but what "cancelled" *is* depends on the
       * dialog: a prompt and a picker return null, a confirm returns false. */
      close(request.kind === "confirm" || request.kind === "error" ? false : null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [request, close]);

  if (!request) return null;

  return (
    <div
      className={styles.backdrop}
      /* Clicks land here and go no further, which is what makes this modal.
         The desktop underneath keeps animating - it is not frozen, just deaf. */
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      role="dialog"
      aria-modal="true"
    >
      {/* Keyed on a counter: without it, renaming one file and then another
          reuses the element and the input still holds the first name. */}
      <Body key={seq} request={request} close={close} />
    </div>
  );
}

type BodyProps = {
  request: DialogRequest;
  close: (value: string | boolean | null) => void;
};

function Body({ request, close }: BodyProps) {
  if (request.kind === "properties") return <Properties request={request} close={close} />;
  if (request.kind === "file") return <FilePicker request={request} close={close} />;
  return <Message request={request} close={close} />;
}

/* ---- prompt / confirm / error --------------------------------------------- */

function Message({
  request,
  close,
}: {
  request: Extract<DialogRequest, { kind: "prompt" | "confirm" | "error" }>;
  close: (value: string | boolean | null) => void;
}) {
  const [value, setValue] = useState(request.kind === "prompt" ? request.value : "");

  /* Focus and select the way a Windows rename box does: the whole name is
   * selected so typing replaces it, and the extension is still there if you
   * only meant to change part of it. */
  const focusInput = useCallback((el: HTMLInputElement | null) => {
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  const accept = () => close(request.kind === "prompt" ? value : true);
  const cancel = () => close(request.kind === "prompt" ? null : false);

  const Icon =
    request.kind === "error" ? ShutdownIcon : request.kind === "confirm" ? HelpIcon : InfoIcon;

  return (
    <div className={`window ${styles.dialog}`}>
      <TitleBar title={request.title} onClose={cancel} />

      <div className="window-body" style={{ margin: 0 }}>
        <div className={styles.body}>
          <Icon size={32} className={styles.icon} />
          <div className={styles.text}>
            {request.kind === "prompt" ? request.label : request.message}

            {request.kind === "prompt" && (
              <input
                ref={focusInput}
                className={styles.field}
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    accept();
                  }
                }}
              />
            )}
          </div>
        </div>

        <div className={styles.buttons}>
          {request.kind === "error" ? (
            <button type="button" onClick={accept} autoFocus>
              OK
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={accept}
                disabled={request.kind === "prompt" && value.trim() === ""}
                autoFocus={request.kind !== "prompt"}
              >
                {request.kind === "prompt" ? request.okLabel : "Yes"}
              </button>
              <button type="button" onClick={cancel}>
                {request.kind === "prompt" ? "Cancel" : "No"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---- Properties ----------------------------------------------------------- */

function Properties({
  request,
  close,
}: {
  request: Extract<DialogRequest, { kind: "properties" }>;
  close: (value: string | boolean | null) => void;
}) {
  const entries = useFsStore((s) => s.entries);
  const entry = entries[request.path];

  /* A folder's size is everything under it, which is the number Windows shows
   * and the only one anybody wants from this dialog. */
  const folderStats = useMemo(() => {
    if (!entry || entry.kind !== "dir") return null;
    const prefix = `${entry.path}/`;
    let bytes = 0;
    let files = 0;
    let folders = 0;
    for (const other of Object.values(entries)) {
      if (!other.path.startsWith(prefix)) continue;
      if (other.kind === "dir") folders += 1;
      else {
        files += 1;
        bytes += entryBytes(other);
      }
    }
    return { bytes, files, folders };
  }, [entries, entry]);

  if (!entry) {
    return (
      <div className={`window ${styles.dialog}`}>
        <TitleBar title={request.title} onClose={() => close(null)} />
        <div className="window-body" style={{ margin: 0 }}>
          <div className={styles.body}>
            <div className={styles.text}>{display(request.path)} no longer exists.</div>
          </div>
          <div className={styles.buttons}>
            <button type="button" onClick={() => close(null)} autoFocus>
              OK
            </button>
          </div>
        </div>
      </div>
    );
  }

  const rows: [string, string][] = [
    ["Type of file:", entryType(entry)],
    ["Location:", display(dirname(entry.path))],
    [
      "Size:",
      entry.kind === "dir"
        ? formatBytes(folderStats?.bytes ?? 0)
        : formatBytes(entryBytes(entry)),
    ],
  ];

  if (entry.kind === "dir" && folderStats) {
    rows.push(["Contains:", `${folderStats.files} Files, ${folderStats.folders} Folders`]);
  }
  if (entry.mime) rows.push(["Content type:", entry.mime]);
  rows.push(["Created:", new Date(entry.created).toLocaleString()]);
  rows.push(["Modified:", new Date(entry.modified).toLocaleString()]);

  return (
    <div className={`window ${styles.dialog}`}>
      <TitleBar title={request.title} onClose={() => close(null)} />

      <div className="window-body" style={{ margin: 0 }}>
        <div className={styles.propsHead}>
          {entryIcon(entry, 32)}
          <span className={styles.propsName}>{basename(entry.path)}</span>
        </div>

        <dl className={styles.propsList}>
          {rows.map(([label, value]) => (
            <div key={label} className={styles.propsRow}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        <div className={styles.buttons}>
          <button type="button" onClick={() => close(null)} autoFocus>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---- Open / Save As -------------------------------------------------------- */

function FilePicker({
  request,
  close,
}: {
  request: Extract<DialogRequest, { kind: "file" }>;
  close: (value: string | boolean | null) => void;
}) {
  const entries = useFsStore((s) => s.entries);
  const [folder, setFolder] = useState(() => normalize(request.folder));
  const [name, setName] = useState(request.fileName);
  const nameRef = useRef<HTMLInputElement>(null);

  const items = useMemo(() => listEntries(entries, folder), [entries, folder]);

  const accept = (fileName = name) => {
    const trimmed = fileName.trim();
    if (!trimmed) return;
    close(join(folder, trimmed));
  };

  const pick = (entry: FsEntry) => {
    if (entry.kind === "dir") {
      setFolder(entry.path);
      return;
    }
    accept(basename(entry.path));
  };

  return (
    <div className={`window ${styles.dialog} ${styles.picker}`}>
      <TitleBar title={request.title} onClose={() => close(null)} />

      <div className="window-body" style={{ margin: 0 }}>
        <div className={styles.pickerBar}>
          <span className={styles.pickerLabel}>Look in:</span>
          <span className={styles.pickerPath} title={display(folder)}>
            {display(folder)}
          </span>
          <button
            type="button"
            disabled={isDriveRoot(folder)}
            onClick={() => setFolder(dirname(folder))}
            title="Up One Level"
          >
            ↑
          </button>
        </div>

        <div className={styles.pickerList}>
          {items.length === 0 && <div className={styles.pickerEmpty}>This folder is empty.</div>}
          {items.map((entry) => (
            <button
              key={entry.path}
              type="button"
              className={
                basename(entry.path) === name.trim()
                  ? `${styles.pickerItem} ${styles.pickerSelected}`
                  : styles.pickerItem
              }
              onClick={() => {
                /* One click fills the name box, two opens it. Clicking a folder
                 * only selects it here, the same as Windows - navigating on a
                 * single click makes the list impossible to read through. */
                if (entry.kind === "file") setName(basename(entry.path));
              }}
              onDoubleClick={() => pick(entry)}
            >
              {entryIcon(entry, 16)}
              <span className={styles.pickerItemLabel}>{basename(entry.path)}</span>
            </button>
          ))}
        </div>

        <div className={styles.pickerBar}>
          <span className={styles.pickerLabel}>File name:</span>
          <input
            ref={nameRef}
            className={styles.pickerName}
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                accept();
              }
            }}
            spellCheck={false}
          />
        </div>

        <div className={styles.buttons}>
          <button type="button" onClick={() => accept()} disabled={name.trim() === ""}>
            {request.mode === "open" ? "Open" : "Save"}
          </button>
          <button type="button" onClick={() => close(null)}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function TitleBar({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="title-bar">
      <div className="title-bar-text">{title}</div>
      <div className="title-bar-controls">
        <button aria-label="Close" onClick={onClose} />
      </div>
    </div>
  );
}
