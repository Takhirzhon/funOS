import type { ComponentType } from "react";
import { cv } from "virtual:portfolio";
import {
  BlankPage,
  BlogPage,
  CannotDisplayPage,
  ContactPage,
  GuestbookPage,
  HomePage,
  PhotosPage,
  PostPage,
  ProjectsPage,
  WorkPage,
  type PageProps,
} from "./pages";

type Page = { title: string; Component: ComponentType<PageProps> };

const PAGES: Record<string, Page> = {
  "about:me": { title: `${cv.name} - Home`, Component: HomePage },
  "about:work": { title: `Work - ${cv.name}`, Component: WorkPage },
  "about:projects": { title: `Projects - ${cv.name}`, Component: ProjectsPage },
  "about:photos": { title: `Photos - ${cv.name}`, Component: PhotosPage },
  "about:guestbook": { title: `Guestbook - ${cv.name}`, Component: GuestbookPage },
  "about:contact": { title: `Contact - ${cv.name}`, Component: ContactPage },
  "about:blank": { title: "about:blank", Component: BlankPage },
  "about:blog": { title: `Blog - ${cv.name}`, Component: BlogPage },
};

/** The page for an address, or the one that says there is not one. */
export const pageFor = (url: string): Page => {
  if (PAGES[url]) return PAGES[url];
  /* A post. The title is the slug for the caption; the page itself knows
   * the real one once it has found the file. */
  if (url.startsWith("about:blog/")) {
    const rest = url.slice("about:blog/".length);
    /* The blog used to be a year a page with an archive; those addresses
     * are the one list now, so a bookmark still lands. */
    if (rest === "archive" || /^[0-9]{4}$/.test(rest)) return PAGES["about:blog"];
    return { title: `${rest} - Blog`, Component: PostPage };
  }
  return { title: "Cannot find server", Component: CannotDisplayPage };
};
