import type { ReactNode } from "react";
import { create } from "zustand";

export type MenuItem =
  | { kind: "separator" }
  | {
      kind: "item";
      label: string;
      onClick?: () => void;
      disabled?: boolean;
      /** The default action, drawn bold - "Open" on a shortcut, say. */
      bold?: boolean;
      icon?: ReactNode;
      submenu?: MenuItem[];
    };

type MenuStore = {
  items: MenuItem[] | null;
  x: number;
  y: number;
  open: (x: number, y: number, items: MenuItem[]) => void;
  close: () => void;
};

/* One menu, globally, rather than a menu per component.
 *
 * Two context menus open at once is a bug you only notice in a screenshot, and
 * every local implementation has to re-solve dismissal, viewport flipping and
 * Escape. It also means the menu renders at the top of the tree, above every
 * window's z-index, instead of being clipped by whatever opened it.
 */
export const useMenuStore = create<MenuStore>((set) => ({
  items: null,
  x: 0,
  y: 0,
  open: (x, y, items) => set({ x, y, items }),
  close: () => set((s) => (s.items ? { items: null } : s)),
}));
