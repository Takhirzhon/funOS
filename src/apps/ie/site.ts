import { createContext, useContext } from "react";

/* What Internet Explorer knows about the world: the home page, the links bar,
 * and how an address typed into it is read. */

export const HOME = "about:me";

export const LINKS = [
  { label: "GitHub", href: "https://github.com/Takhirzhon" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/tokhirzhon-s-tashmatov-6aba2120b/" },
  { label: "ResearchGate", href: "https://www.researchgate.net/profile/Tokhirzhon-Tashmatov" },
  { label: "khirokhito.tech", href: "https://khirokhito.tech" },
] as const;

export const EMAIL = "tashmatovtahir@gmail.com";

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

/** How a page asks the browser around it to go somewhere. */
export const NavigateContext = createContext<(url: string) => void>(() => {});
export const useNavigate = () => useContext(NavigateContext);
