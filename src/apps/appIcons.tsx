import type { CSSProperties } from "react";
import { useFsStore } from "../store/fsStore";
import { RECYCLE_BIN } from "../fs/seed";
import { RecycleBinFullIcon, RecycleBinIcon } from "../icons";

/* App icons that depend on state rather than being a constant.
 *
 * No change to the registry was needed for this: an icon there is already a
 * React component, and a component may use hooks. Anything that wants to draw
 * itself from the file system - a drive showing whether a disc is in it, a
 * folder showing whether it is shared - can be written the same way, and every
 * call site keeps working because none of them ever did more than render it.
 */
type Props = { size?: number; style?: CSSProperties; className?: string };

export function RecycleBinAppIcon(props: Props) {
  /* Subscribing to a boolean, not to `entries`. Selecting the whole map would
   * re-render every desktop icon and every task button on each keystroke in
   * Notepad, because saving rewrites the map.
   */
  const full = useFsStore((s) =>
    Object.keys(s.entries).some((path) => path.startsWith(`${RECYCLE_BIN}/`))
  );
  return full ? <RecycleBinFullIcon {...props} /> : <RecycleBinIcon {...props} />;
}
