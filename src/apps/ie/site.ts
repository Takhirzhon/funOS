import { createContext, useContext } from "react";
import { cv } from "virtual:portfolio";

/* What Internet Explorer knows about the world: the home page, the links bar,
 * and how an address typed into it is read. */

export const HOME = "about:me";

/* The links bar and the e-mail address are the CV's (public/portfolio/
 * cv.json), plus the site itself - which was on every links bar in 2004,
 * and is the one address a visitor can copy from here. */
export const LINKS: readonly { label: string; href: string }[] = [
  ...cv.links,
  { label: "khirokhito.tech", href: "https://khirokhito.tech" },
];

export const EMAIL = cv.email;

/* Real sites open in a real tab. `noopener` because the new tab must not get
 * a handle on this one, and because it is what makes the tab open in the
 * background on most browsers - the desktop stays where it was. */
export const openExternal = (href: string): void => {
  window.open(href, "_blank", "noopener");
};

/* What the address bar makes of what was typed. "about:me" and friends are
 * ours; anything with a dot in it is a site, and a site without a scheme gets
 * http:// the way IE gave it. The rest is a page that does not exist. */
export function normalizeUrl(input: string): string {
  const raw = input.trim();
  const lower = raw.toLowerCase();
  if (lower.startsWith("about:")) return lower;
  if (/^https?:\/\//.test(lower)) return raw;
  if (lower === "" || lower === "home") return HOME;
  if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(raw)) return `http://${raw}`;
  return `about:${lower}`;
}

/* The site's addresses as the real address bar shows them. about:work is
 * khirokhito.tech/work, about:blog/x is /blog/x, and the home page is the
 * site itself - a link to the site is a link to the desktop. These are the
 * addresses that go in a cover letter, a sitemap and a feed; the about:
 * form is what Internet Explorer shows once it is open. about:blank and a
 * page that does not exist have no outside address.
 *
 * nginx and the dev server both answer every path with index.html, so a
 * visitor arriving at /projects lands on the desktop, and Desktop.tsx opens
 * Internet Explorer on the page the path names. */
const ROUTES: Record<string, string> = {
  "about:me": "/",
  "about:work": "/work",
  "about:projects": "/projects",
  "about:photos": "/photos",
  "about:guestbook": "/guestbook",
  "about:contact": "/contact",
  "about:blog": "/blog",
};

/* Not a page: the PDF on the desktop, opened in its reader. The one address
 * a recruiter is given in a cover letter. */
export const CV_PATH = "/cv";

const BLOG_URL = "about:blog/";
const BLOG_PATH = "/blog/";

export function pathFor(url: string): string | undefined {
  if (ROUTES[url]) return ROUTES[url];
  if (url.startsWith(BLOG_URL)) return `${BLOG_PATH}${url.slice(BLOG_URL.length)}`;
  return undefined;
}

export function urlForPath(path: string): string | undefined {
  const p = path.replace(/\/+$/, "").toLowerCase() || "/";
  for (const [url, route] of Object.entries(ROUTES)) if (route === p) return url;
  if (p.startsWith(BLOG_PATH)) return `${BLOG_URL}${p.slice(BLOG_PATH.length)}`;
  return undefined;
}

/** How a page asks the browser around it to go somewhere. */
export const NavigateContext = createContext<(url: string) => void>(() => {});
export const useNavigate = () => useContext(NavigateContext);
