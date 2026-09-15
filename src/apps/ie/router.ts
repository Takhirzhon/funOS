import type { ComponentType } from "react";
import { BlankPage, CannotDisplayPage, ContactPage, HomePage, ProjectsPage, WorkPage, type PageProps } from "./pages";

type Page = { title: string; Component: ComponentType<PageProps> };

const PAGES: Record<string, Page> = {
  "about:me": { title: "Tokhirzhon Tashmatov - Home", Component: HomePage },
  "about:work": { title: "Work - Tokhirzhon Tashmatov", Component: WorkPage },
  "about:projects": { title: "Projects - Tokhirzhon Tashmatov", Component: ProjectsPage },
  "about:contact": { title: "Contact - Tokhirzhon Tashmatov", Component: ContactPage },
  "about:blank": { title: "about:blank", Component: BlankPage },
};

/** The page for an address, or the one that says there is not one. */
export const pageFor = (url: string): Page =>
  PAGES[url] ?? { title: "Cannot find server", Component: CannotDisplayPage };
