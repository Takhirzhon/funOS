import { useWindowStore } from "../store/windowStore";
import { useFolderOptions } from "../store/folderOptions";
import { FolderOptionsIcon } from "../icons";
import styles from "./FolderOptions.module.css";

type Props = { windowId?: string };

/* Folder Options, the View tab: the one setting here that exists, drawn
 * the way XP drew it - a tree of checkboxes and radio buttons under
 * "Advanced settings", of which one pair does something. The rest are
 * listed disabled, because a View tab with one line is not the View tab. */
/* xp.css draws a checkbox or radio from `input + label`, so each line is
 * those two, not a label around an input. */
function Leaf({
  id,
  type,
  label,
  checked,
  disabled,
  deep,
  onChange,
}: {
  id: string;
  type: "checkbox" | "radio";
  label: string;
  checked: boolean;
  disabled?: boolean;
  deep?: boolean;
  onChange?: () => void;
}) {
  return (
    <div className={deep ? `${styles.leaf} ${styles.deep}` : styles.leaf}>
      <input id={id} type={type} name={type === "radio" ? "hidden" : undefined} checked={checked} disabled={disabled} readOnly={!onChange} onChange={onChange} />
      <label htmlFor={id}>{label}</label>
    </div>
  );
}

export function FolderOptions({ windowId }: Props) {
  const close = useWindowStore((s) => s.close);
  const showHidden = useFolderOptions((s) => s.showHidden);
  const setShowHidden = useFolderOptions((s) => s.setShowHidden);

  return (
    <div className={styles.app}>
      <div className={styles.tabs}>
        <span className={styles.tab}>General</span>
        <span className={`${styles.tab} ${styles.active}`}>View</span>
        <span className={styles.tab}>File Types</span>
      </div>
      <div className={styles.page}>
        <fieldset className={styles.group}>
          <legend>Folder views</legend>
          <div className={styles.views}>
            <FolderOptionsIcon size={32} />
            <span>
              You can apply the view (such as Details or Thumbnails) that you are using for this folder to all
              folders. Here, each folder remembers its own.
            </span>
          </div>
        </fieldset>

        <div className={styles.advancedHead}>Advanced settings:</div>
        <div className={styles.tree}>
          <div className={styles.node}>
            <b>Files and Folders</b>
          </div>
          <Leaf id="fo-tips" type="checkbox" label="Display file size information in folder tips" checked disabled />
          <Leaf id="fo-path" type="checkbox" label="Display the full path in the title bar" checked disabled />
          <div className={styles.node}>Hidden files and folders</div>
          <Leaf id="fo-hide" type="radio" label="Do not show hidden files and folders" checked={!showHidden} deep onChange={() => setShowHidden(false)} />
          <Leaf id="fo-show" type="radio" label="Show hidden files and folders" checked={showHidden} deep onChange={() => setShowHidden(true)} />
          <Leaf id="fo-ext" type="checkbox" label="Hide extensions for known file types" checked={false} disabled />
          <Leaf id="fo-os" type="checkbox" label="Hide protected operating system files (Recommended)" checked disabled />
          <Leaf id="fo-remember" type="checkbox" label="Remember each folder's view settings" checked disabled />
          <Leaf id="fo-ntfs" type="checkbox" label="Show encrypted or compressed NTFS files in color" checked disabled />
        </div>
      </div>
      <div className={styles.footer}>
        <button type="button" onClick={() => windowId && close(windowId)} autoFocus>
          OK
        </button>
        <button type="button" onClick={() => windowId && close(windowId)}>
          Cancel
        </button>
        <button type="button" disabled>
          Apply
        </button>
      </div>
    </div>
  );
}
