import type { ComponentType } from "react";
import { BlankPage, BlogPage, CannotDisplayPage, ContactPage, HomePage, PostPage, ProjectsPage, WorkPage, type PageProps } from "./pages";

type Page = { title: string; Component: ComponentType<PageProps> };

const PAGES: Record<string, Page> = {
  "about:me": { title: "Tokhirzhon Tashmatov - Home", Component: HomePage },
  "about:work": { title: "Work - Tokhirzhon Tashmatov", Component: WorkPage },
  "about:projects": { title: "Projects - Tokhirzhon Tashmatov", Component: ProjectsPage },
  "about:contact": { title: "Contact - Tokhirzhon Tashmatov", Component: ContactPage },
  "about:blank": { title: "about:blank", Component: BlankPage },
  "about:blog": { title: "Blog - Tokhirzhon Tashmatov", Component: BlogPage },
};

/** The page for an address, or the one that says there is not one. */
export const pageFor = (url: string): Page => {
  if (PAGES[url]) return PAGES[url];
  /* A post. The title is the slug for the caption; the page itself knows
   * the real one once it has found the file. */
  if (url.startsWith("about:blog/")) {
    return { title: `${url.slice("about:blog/".length)} - Blog`, Component: PostPage };
  }
  return { title: "Cannot find server", Component: CannotDisplayPage };
};
