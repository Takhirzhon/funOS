import { useEffect, useState, type FormEvent } from "react";
import { useWindowStore } from "../store/windowStore";
import { errorDialog } from "../store/dialogStore";
import { MenuBar } from "../components/MenuBar";
import {
  BackIcon,
  FavoritesIcon,
  ForwardIcon,
  GoIcon,
  HistoryIcon,
  HomeIcon,
  IEIcon,
  InternetShortcutIcon,
  RefreshIcon,
  SearchIcon,
  StopIcon,
} from "../icons";
import { HOME, LINKS, NavigateContext, openExternal, normalizeUrl } from "./ie/site";
import { pageFor } from "./ie/router";
import { postUrl, usePosts } from "../blog/posts";
import styles from "./InternetExplorer.module.css";

type Props = { url?: string; windowId?: string };

/* Internet Explorer 6, as the front door.
 *
 * Not a browser. Nearly every site refuses to be framed, and a window that is
 * blank for a reason the visitor cannot see is worse than no window. What IE
 * is here is the thing it was on every home computer in 2004: the program you
 * opened to see somebody's home page. The home page is mine, written by hand
 * under about:, with the links bar pointing at the real sites - which open in
 * a real tab, because that is where they work.
 *
 * Typing any other address gets the page everybody remembers, "The page
 * cannot be displayed", with one honest addition: a button that opens the
 * address in the browser this is running in.
 */
export function InternetExplorer({ url, windowId }: Props) {
  const setTitle = useWindowStore((s) => s.setTitle);
  const [history, setHistory] = useState(() => ({ stack: [normalizeUrl(url ?? HOME)], index: 0 }));
  const current = history.stack[history.index];
  /* What is being typed, or null for "the address of the page": the bar
   * shows the page's address until somebody edits it, and goes back to
   * showing it after every navigation without an effect to copy it over. */
  const [edited, setEdited] = useState<string | null>(null);
  const address = edited ?? current;
  /* Bumped by Refresh: remounts the page, which is all refresh means here. */
  const [generation, setGeneration] = useState(0);
  /* The Explorer bar down the left: Favorites or History, or nothing. */
  const [sidebar, setSidebar] = useState<"favorites" | "history" | null>(null);
  const toggleSidebar = (which: "favorites" | "history") =>
    setSidebar((s) => (s === which ? null : which));

  const page = pageFor(current);
  /* A post's caption is its title, which only the post list knows. */
  const posts = usePosts();
  const post = current.startsWith("about:blog/") ? posts.find((p) => postUrl(p) === current) : undefined;
  const title = post ? `${post.title} - Blog` : page.title;

  useEffect(() => {
    if (windowId) setTitle(windowId, `${title} - Internet Explorer`);
  }, [windowId, title, setTitle]);

  /* The address bar's address is also the site's: about:blog/x becomes
   * #about:blog/x in the real URL bar, so a page can be linked to from
   * outside and the desktop opens it on arrival (Desktop.tsx). The home
   * page clears it - a link to the site is a link to the desktop. */
  useEffect(() => {
    const hash = current === HOME ? "" : `#${current}`;
    if (current.startsWith("about:") && window.location.hash !== hash) {
      window.history.replaceState(null, "", hash || window.location.pathname);
    }
  }, [current]);

  const navigate = (to: string) => {
    const target = normalizeUrl(to);
    setEdited(null);
    if (target === current) {
      setGeneration((g) => g + 1);
      return;
    }
    setHistory((h) => ({
      stack: [...h.stack.slice(0, h.index + 1), target],
      index: h.index + 1,
    }));
  };

  const go = (delta: number) => {
    setEdited(null);
    setHistory((h) => {
      const index = h.index + delta;
      return h.stack[index] ? { ...h, index } : h;
    });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (address.trim()) navigate(address);
  };

  const canBack = history.index > 0;
  const canForward = history.index < history.stack.length - 1;

  return (
    <div className={styles.app}>
      <MenuBar
        menus={[
          {
            label: "File",
            items: [
              {
                label: "New Window",
                onClick: () =>
                  useWindowStore
                    .getState()
                    .open("internetExplorer", { title: "Internet Explorer", bounds: { width: 780, height: 580 } }),
              },
              { label: "Open in Your Browser...", onClick: () => openExternal(current), disabled: !current.startsWith("http") },
            ],
          },
          {
            label: "View",
            items: [
              { label: "Refresh", onClick: () => setGeneration((g) => g + 1) },
              { label: "Home", onClick: () => navigate(HOME) },
            ],
          },
          {
            label: "Favorites",
            items: LINKS.map((l) => ({ label: l.label, onClick: () => openExternal(l.href) })),
          },
          {
            label: "Help",
            items: [
              {
                label: "About Internet Explorer",
                onClick: () =>
                  void errorDialog(
                    "About Internet Explorer",
                    "Internet Explorer for funOS\nVersion 6.0 (in spirit)\n\nShows the about: pages that live in this desktop, and opens everything else in the browser you are already using - most sites refuse to be shown inside another page, and this one is honest about it."
                  ),
              },
            ],
          },
        ]}
      />

      {/* Standard Buttons */}
      <div className={styles.bar}>
        <span className={styles.grip} />
        <button type="button" className={styles.navButton} disabled={!canBack} onClick={() => go(-1)}>
          <BackIcon /> Back <span className={styles.dropArrow}>▾</span>
        </button>
        <button type="button" className={styles.navButton} disabled={!canForward} onClick={() => go(1)}>
          <ForwardIcon /> <span className={styles.dropArrow}>▾</span>
        </button>
        <button type="button" className={styles.iconButton} disabled title="Stop">
          <StopIcon />
        </button>
        <button type="button" className={styles.iconButton} title="Refresh" onClick={() => setGeneration((g) => g + 1)}>
          <RefreshIcon />
        </button>
        <button type="button" className={styles.iconButton} title="Home" onClick={() => navigate(HOME)}>
          <HomeIcon />
        </button>
        <span className={styles.divider} />
        <button type="button" className={`${styles.navButton} ${styles.searchButton}`} disabled title="Search">
          <SearchIcon size={22} /> Search
        </button>
        <button
          type="button"
          className={sidebar === "favorites" ? `${styles.navButton} ${styles.pressed}` : styles.navButton}
          onClick={() => toggleSidebar("favorites")}
        >
          <FavoritesIcon /> Favorites
        </button>
        <button
          type="button"
          className={sidebar === "history" ? `${styles.navButton} ${styles.pressed}` : styles.navButton}
          onClick={() => toggleSidebar("history")}
        >
          <HistoryIcon /> History
        </button>
      </div>

      {/* Address */}
      <form className={styles.bar} onSubmit={submit}>
        <span className={styles.grip} />
        <span className={styles.label}>Address</span>
        <div className={styles.addressWrap}>
          <span className={styles.addressIcon}>
            {current.startsWith("about:") ? <IEIcon /> : <InternetShortcutIcon />}
          </span>
          <input
            className={styles.address}
            value={address}
            onChange={(e) => setEdited(e.target.value)}
            onFocus={(e) => e.target.select()}
            spellCheck={false}
            aria-label="Address"
          />
        </div>
        <button type="submit" className={styles.goButton}>
          <GoIcon /> Go
        </button>
      </form>

      {/* Links */}
      <div className={styles.bar}>
        <span className={styles.grip} />
        <span className={styles.label}>Links</span>
        {LINKS.map((l) => (
          <button key={l.href} type="button" className={styles.link} onClick={() => openExternal(l.href)}>
            <InternetShortcutIcon /> {l.label}
          </button>
        ))}
      </div>

      <div className={styles.main}>
        {sidebar && (
          <div className={styles.sidebar}>
            <div className={styles.sidebarHead}>
              {sidebar === "favorites" ? "Favorites" : "History"}
              <button type="button" className={styles.sidebarClose} onClick={() => setSidebar(null)} aria-label="Close">
                ×
              </button>
            </div>
            {sidebar === "favorites" &&
              LINKS.map((l) => (
                <button key={l.href} type="button" className={styles.sidebarItem} onClick={() => openExternal(l.href)}>
                  <InternetShortcutIcon /> {l.label}
                </button>
              ))}
            {sidebar === "history" &&
              /* Newest first, like the real one, and without the duplicates
                 a Back-and-Forward session leaves in the stack. */
              [...new Set([...history.stack].reverse())].map((u) => (
                <button key={u} type="button" className={styles.sidebarItem} onClick={() => navigate(u)}>
                  {u.startsWith("about:") ? <IEIcon /> : <InternetShortcutIcon />} {pageFor(u).title}
                </button>
              ))}
          </div>
        )}
        <div className={styles.page}>
          <NavigateContext.Provider value={navigate}>
            <page.Component key={`${current}:${generation}`} url={current} />
          </NavigateContext.Provider>
        </div>
      </div>

      <div className={styles.status}>
        <span className={styles.statusMain}>Done</span>
        <span className={styles.statusZone}>
          <IEIcon /> {current.startsWith("about:") ? "My Computer" : "Internet"}
        </span>
      </div>
    </div>
  );
}
