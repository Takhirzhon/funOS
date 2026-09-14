import type { MenuItem } from "../store/menuStore";
import { useWindowStore, type WindowState } from "../store/windowStore";

/* The window system menu - what you get from the title bar's icon, from
 * right-clicking the title bar, and from right-clicking the task button.
 *
 * Shared rather than written twice because the three are the same menu in
 * Windows, and a system menu that offers Maximize on an already-maximized
 * window is the kind of small wrongness that adds up.
 */
export function windowSystemMenu(w: WindowState): MenuItem[] {
  const { focus, minimize, toggleMaximize, close } = useWindowStore.getState();

  return [
    {
      kind: "item",
      label: "Restore",
      disabled: !w.minimized && !w.maximized,
      onClick: () => (w.maximized ? toggleMaximize(w.id) : focus(w.id)),
    },
    { kind: "item", label: "Move", disabled: true },
    { kind: "item", label: "Size", disabled: true },
    {
      kind: "item",
      label: "Minimize",
      disabled: w.minimized,
      onClick: () => minimize(w.id),
    },
    {
      kind: "item",
      label: "Maximize",
      disabled: w.maximized,
      onClick: () => {
        if (w.minimized) focus(w.id);
        toggleMaximize(w.id);
      },
    },
    { kind: "separator" },
    { kind: "item", label: "Close", bold: true, onClick: () => close(w.id) },
  ];
}
