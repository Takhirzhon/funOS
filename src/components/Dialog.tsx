import { useCallback, useEffect, useRef, useState } from "react";
import { useDialogStore } from "../store/dialogStore";
import { HelpIcon, InfoIcon, ShutdownIcon } from "../icons";
import styles from "./Dialog.module.css";

/* The one modal dialog, mounted once in App next to the context menu. */
export function Dialog() {
  const request = useDialogStore((s) => s.request);
  const seq = useDialogStore((s) => s.seq);
  const close = useDialogStore((s) => s.close);

  if (!request) return null;

  return <DialogBody key={seq} request={request} close={close} />;
}

type Props = {
  request: NonNullable<ReturnType<typeof useDialogStore.getState>["request"]>;
  close: (value: string | boolean | null) => void;
};

function DialogBody({ request, close }: Props) {
  const [value, setValue] = useState(request.kind === "prompt" ? request.value : "");
  const inputRef = useRef<HTMLInputElement>(null);

  /* Focus and select, the way a Windows rename box does: the whole name is
   * selected so typing replaces it, but the extension is still there if you
   * only want to change part of it.
   */
  const focusInput = useCallback((el: HTMLInputElement | null) => {
    inputRef.current = el;
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  const accept = () => close(request.kind === "prompt" ? value : true);
  const cancel = () => close(request.kind === "prompt" ? null : false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const Icon =
    request.kind === "error" ? ShutdownIcon : request.kind === "confirm" ? HelpIcon : InfoIcon;

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
      <div className={`window ${styles.dialog}`}>
        <div className="title-bar">
          <div className="title-bar-text">{request.title}</div>
          <div className="title-bar-controls">
            <button aria-label="Close" onClick={cancel} />
          </div>
        </div>

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
    </div>
  );
}
