import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { blobUrlFor, listEntries, useFsStore, type FsEntry } from "../../store/fsStore";
import { DESKTOP_DIR, MY_DOCUMENTS } from "../../fs/seed";
import { basename, join } from "../../fs/path";
import { launchFile } from "../../fs/open";
import { EMAIL, LINKS, openExternal, useNavigate } from "./site";
import { postUrl, usePosts } from "../../blog/posts";
import { Markdown } from "./Markdown";
import { cv, type CvDate } from "virtual:portfolio";
import styles from "./pages.module.css";

/* The home page, as one was in 2004: a table with a menu down the left, a
 * photograph with a bevelled border, Verdana at 12px, a visitor counter, and
 * "best viewed at 800x600" at the bottom. Hand-written, the way they were.
 *
 * The facts on it - the jobs, the projects, the links, what is new - are
 * public/portfolio/cv.json, next to the PDF they come from. The prose around
 * them is here. When the CV changes, cv.json is the place to change.
 */

const PICTURES = join(MY_DOCUMENTS, "My Pictures");
const VIDEOS = join(MY_DOCUMENTS, "My Videos");
/** Project screenshots, one per project, named in cv.json. */
const PROJECT_SHOTS = join(PICTURES, "Projects");

export type PageProps = { url: string };

/* A link that knows the difference between a page here and a site out there. */
function A({ href, children }: { href: string; children: ReactNode }) {
  const navigate = useNavigate();
  const internal = href.startsWith("about:");
  return (
    <a
      href={href}
      className={styles.a}
      onClick={(e) => {
        e.preventDefault();
        if (internal) navigate(href);
        else if (href.startsWith("mailto:")) window.location.href = href;
        else openExternal(href);
      }}
    >
      {children}
    </a>
  );
}

const NAV = [
  ["about:me", "Home"],
  ["about:blog", "Blog"],
  ["about:work", "Work"],
  ["about:projects", "Projects"],
  ["about:photos", "Photos"],
  ["about:guestbook", "Guestbook"],
  ["about:contact", "Contact"],
] as const;

/* A date the way a 2004 page wrote one: "16 September 2026" - or as much of
 * it as cv.json gives: "June 2026", "2025". */
const longDate = (date: CvDate) => {
  const [y, m, d] = date.split("-");
  const when = new Date(Date.UTC(Number(y), Number(m ?? 1) - 1, Number(d ?? 1), 12));
  return when.toLocaleDateString("en-GB", {
    ...(d ? { day: "numeric" } : {}),
    ...(m ? { month: "long" } : {}),
    year: "numeric",
  });
};

/* "Jul 2025 – present", the way a CV writes a span. */
const shortDate = (date: CvDate) => {
  const [y, m] = date.split("-");
  return m ? new Date(Date.UTC(Number(y), Number(m) - 1, 15)).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : y;
};
const span = (from: CvDate, to: CvDate | null) => `${shortDate(from)} – ${to ? shortDate(to) : "present"}`;

function Layout({ url, title, children }: PageProps & { title: string; children: ReactNode }) {
  /* The Blog entry stays lit on a post's page too. */
  const section = url.startsWith("about:blog") ? "about:blog" : url;
  return (
    <div className={styles.site}>
      <div className={styles.masthead}>
        <span className={styles.mastName}>{cv.name}</span>
        <span className={styles.mastSub}>{cv.title} &middot; {cv.location.city}, {cv.location.country}</span>
      </div>
      <div className={styles.columns}>
        <div className={styles.nav}>
          {NAV.map(([href, label]) => (
            <div key={href} className={section === href ? `${styles.navItem} ${styles.navCurrent}` : styles.navItem}>
              <A href={href}>{label}</A>
            </div>
          ))}
          <div className={styles.navRule} />
          {LINKS.map((l) => (
            <div key={l.href} className={styles.navItem}>
              <A href={l.href}>{l.label}</A>
            </div>
          ))}
        </div>
        <div className={styles.content}>
          <h1 className={styles.h1}>{title}</h1>
          {children}
        </div>
      </div>
      <div className={styles.footer}>
        <span>&copy; 2004&ndash;{new Date().getFullYear()} {cv.name}. Best viewed at 800&times;600 in Internet Explorer 6.</span>
      </div>
    </div>
  );
}

/* One increment per visit, not per render or per mount: the session flag
 * makes a second call a read, which is also what makes this safe to run in
 * a state initializer that strict mode calls twice. */
function countVisit(): number {
  try {
    const counted = sessionStorage.getItem("ie.counted") === "1";
    const n = Number(localStorage.getItem("ie.hits") ?? "0") + (counted ? 0 : 1);
    if (!counted) {
      localStorage.setItem("ie.hits", String(n));
      sessionStorage.setItem("ie.counted", "1");
    }
    return n;
  } catch {
    /* Private mode with storage disabled: every visitor is the first. */
    return 1;
  }
}

const useHitCounter = (): number => useState(countVisit)[0];

/* The photograph on the home page: the portrait if there is one in My
 * Pictures, otherwise the first picture there. */
function usePortrait(): string | undefined {
  const entries = useFsStore((s) => s.entries);
  const pictures = listEntries(entries, PICTURES).filter((e) => e.mime?.startsWith("image/"));
  const entry = pictures.find((e) => /portrait/i.test(e.path)) ?? pictures[0];
  return entry ? blobUrlFor(entry) : undefined;
}

export function HomePage({ url }: PageProps) {
  const hits = useHitCounter();
  const portrait = usePortrait();
  const now = cv.work.find((j) => j.to === null);
  const before = cv.work.filter((j) => j !== now);
  return (
    <Layout url={url} title="Welcome to my home page!">
      <div className={styles.intro}>
        {portrait && <img src={portrait} alt={cv.givenName} className={styles.portrait} />}
        <div>
          <p>
            Hello, and thanks for stopping by. I am an AI/ML engineer from {cv.location.city}. I ship production LLM
            applications end to end &mdash; agents, RAG, retrieval &mdash; and I build the adversarial
            evaluation and red-teaming tooling that stress-tests them and measures where they fail.
          </p>
          <p>
            Strong Python and data-engineering foundation. Bias toward building, testing and measuring
            what actually works.
          </p>
          {now && (
            <p>
              Right now I am a {now.role} at <b>{now.org}</b> ({now.where.replace(/^Remote \((.+)\)$/, "remote, $1")}).
              Before that: {before.map((j) => `${j.role} at ${j.org}`).join(", ")}. The whole story is under{" "}
              <A href="about:work">Work</A>; the things I build for fun and on purpose are under{" "}
              <A href="about:projects">Projects</A>.
            </p>
          )}
          <p>
            When I am not at a keyboard I am in the Tian Shan &mdash; Ala-Archa is an hour from my door, and
            that is me on Uchitel Peak, 4,530 m, under <A href="about:photos">Photos</A>.
          </p>
        </div>
      </div>

      <h2 className={styles.h2}>What&rsquo;s new</h2>
      <ul className={styles.news}>
        {cv.news.map((n) => (
          <li key={n.date + n.text.slice(0, 20)}>
            <span className={styles.newsDate}>{longDate(n.date)}</span>
            {n.text}
            {n.href && n.label && (
              <>
                {" "}
                <A href={n.href}>{n.label}</A>
              </>
            )}
          </li>
        ))}
      </ul>

      <h2 className={styles.h2}>Quick facts</h2>
      <table className={styles.facts}>
        <tbody>
          <tr><td>Location</td><td>{cv.location.city}, {cv.location.country} (remote-friendly)</td></tr>
          <tr><td>Languages</td><td>{cv.skills.Languages}</td></tr>
          <tr><td>Spoken</td><td>{cv.spoken.map((s) => `${s.language} (${s.level})`).join(", ")}</td></tr>
          <tr><td>Education</td><td>{cv.education.map((e) => `${e.degree}, ${e.school}`).join(" · ")}</td></tr>
          <tr><td>Honors</td><td>{cv.honors.join(" · ")}</td></tr>
        </tbody>
      </table>

      <div className={styles.counterRow}>
        <span>Visits from this computer:</span>
        <span className={styles.counter} title="Counted in this browser only - like every counter ever was, honestly">
          {String(hits).padStart(6, "0")}
        </span>
      </div>
    </Layout>
  );
}

export function WorkPage({ url }: PageProps) {
  return (
    <Layout url={url} title="Work">
      {cv.work.map((job) => (
        <div key={job.org} className={styles.entry}>
          <div className={styles.entryHead}>
            <b>{job.role}</b> &mdash; {job.org}
            <span className={styles.entryWhen}>{span(job.from, job.to)} &middot; {job.where}</span>
          </div>
          <ul className={styles.list}>
            {job.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      ))}
      <h2 className={styles.h2}>Education</h2>
      <ul className={styles.list}>
        {cv.education.map((e) => (
          <li key={e.school}>
            <b>{e.school}</b> &mdash; {e.degree}, {span(e.from, e.to)}, {e.where}.{e.note && ` ${e.note}`}
          </li>
        ))}
      </ul>
      <p className={styles.small}>
        The full CV is on the desktop &mdash; <A href="about:contact">download it here</A>.
      </p>
    </Layout>
  );
}

/* "Click to enlarge", the way it was: a small picture with the bevelled
 * frame, and the full thing opens in Windows Picture Viewer. */
function Thumb({ entry, caption, wide }: { entry: FsEntry; caption: string; wide?: boolean }) {
  const src = blobUrlFor(entry);
  if (!src) return null;
  const video = entry.mime?.startsWith("video/");
  return (
    <a
      href={src}
      className={wide ? `${styles.thumb} ${styles.thumbWide}` : styles.thumb}
      title="Click to enlarge"
      onClick={(e) => {
        e.preventDefault();
        launchFile(entry);
      }}
    >
      {video ? (
        <video src={src} className={styles.thumbImg} muted playsInline preload="metadata" />
      ) : (
        <img src={src} alt={caption} className={styles.thumbImg} loading="lazy" decoding="async" />
      )}
      {video && <span className={styles.thumbPlay}>&#9654;</span>}
      <span className={styles.thumbCaption}>{caption}</span>
    </a>
  );
}

export function ProjectsPage({ url }: PageProps) {
  const entries = useFsStore((s) => s.entries);
  return (
    <Layout url={url} title="Projects & open source">
      {cv.projects.map((p) => {
        const shot = p.screenshot ? entries[join(PROJECT_SHOTS, p.screenshot)] : undefined;
        return (
          <div key={p.name} className={styles.entry}>
            <div className={styles.entryHead}>
              <b>{p.href ? <A href={p.href}>{p.name}</A> : p.name}</b>
              <span className={styles.entryWhen}>{p.tag}</span>
            </div>
            <div className={styles.project}>
              {shot && <Thumb entry={shot} caption="Click to enlarge" wide />}
              <p className={styles.p}>
                {p.text}
                {p.more && (
                  <>
                    {" "}
                    <A href={p.more.href}>{p.more.label}</A>.
                  </>
                )}
              </p>
            </div>
          </div>
        );
      })}
      {/* Not for the search engines: this is drawn inside a window they never
          open. What they read is the JSON-LD in index.html. */}
      <h2 className={styles.h2}>Skills</h2>
      <p className={styles.p}>
        {Object.entries(cv.skills).map(([group, list]) => (
          <span key={group}>
            <b>{group}:</b> {list}.{" "}
          </span>
        ))}
      </p>
    </Layout>
  );
}

/* The photo page every home page had: a grid of small pictures with the
 * file name for a caption, "click to enlarge". The pictures are My Pictures
 * and the clips are My Videos - the same files Explorer shows, in the same
 * order, so a caption is the file's name and nothing else has to be kept in
 * step. Screenshots of projects live in a subfolder and are not here. */
const stem = (entry: FsEntry) => basename(entry.path).replace(/\.[^.]+$/, "");

export function PhotosPage({ url }: PageProps) {
  const entries = useFsStore((s) => s.entries);
  const pictures = listEntries(entries, PICTURES).filter(
    (e) => e.mime?.startsWith("image/") && !/portrait/i.test(e.path)
  );
  const videos = listEntries(entries, VIDEOS).filter((e) => e.mime?.startsWith("video/"));
  return (
    <Layout url={url} title="Photos">
      <p className={styles.p}>
        Most of these are the Tian Shan, an hour south of Bishkek: the Ala-Archa gorge, the Ratsek hut at the top
        of the Ak-Sai valley, and Uchitel Peak at 4,530 m. Click a picture and it opens in Windows Picture Viewer;
        the arrows there walk the whole folder. They are the files in My Pictures, so you can also just open that.
      </p>
      {pictures.length === 0 && <p className={styles.p}>No pictures yet.</p>}
      <div className={styles.gallery}>
        {pictures.map((e) => (
          <Thumb key={e.path} entry={e} caption={stem(e)} />
        ))}
      </div>
      {videos.length > 0 && (
        <>
          <h2 className={styles.h2}>Clips</h2>
          <p className={styles.small}>Short ones, from a phone. They open in Windows Media Player.</p>
          <div className={styles.gallery}>
            {videos.map((e) => (
              <Thumb key={e.path} entry={e} caption={stem(e)} />
            ))}
          </div>
        </>
      )}
    </Layout>
  );
}

/* Contact, in the order a recruiter reads it: am I looking, where am I,
 * when am I awake - then how to reach me, then the PDF. */
export function ContactPage({ url }: PageProps) {
  const entries = useFsStore((s) => s.entries);
  const pdf = listEntries(entries, DESKTOP_DIR).find((e) => e.mime === "application/pdf");
  const pdfUrl = pdf && blobUrlFor(pdf);
  const pdfName = pdf && basename(pdf.path);
  return (
    <Layout url={url} title="Contact">
      <table className={styles.facts}>
        <tbody>
          <tr><td>Status</td><td><b>{cv.availability.status}</b></td></tr>
          <tr><td>Time zone</td><td>{cv.availability.timezone}</td></tr>
          <tr><td>Overlap</td><td>{cv.availability.overlap}</td></tr>
        </tbody>
      </table>

      <h2 className={styles.h2}>Reach me</h2>
      <p className={styles.p}>The best way is e-mail. I answer, usually the same day.</p>
      <table className={styles.facts}>
        <tbody>
          <tr><td>E-mail</td><td><A href={`mailto:${EMAIL}`}>{EMAIL}</A></td></tr>
          {cv.telegram && (
            <tr><td>Telegram</td><td><A href={cv.telegram}>{cv.telegram.replace(/^https?:\/\//, "")}</A></td></tr>
          )}
          {LINKS.map((l) => (
            <tr key={l.href}><td>{l.label}</td><td><A href={l.href}>{l.href.replace(/^https?:\/\//, "")}</A></td></tr>
          ))}
        </tbody>
      </table>

      <h2 className={styles.h2}>Curriculum vitae</h2>
      {pdf && pdfUrl ? (
        <p className={styles.p}>
          <button type="button" className={styles.button} onClick={() => launchFile(pdf)}>
            Open {pdfName}
          </button>{" "}
          {/* A real download, not the reader: on a phone the reader shows one
              page and stops, and the PDF is the thing a recruiter forwards. */}
          <button
            type="button"
            className={styles.button}
            onClick={() => {
              const a = document.createElement("a");
              a.href = pdfUrl;
              a.download = pdfName ?? "CV.pdf";
              a.click();
            }}
          >
            Download
          </button>{" "}
          <span className={styles.small}>&mdash; it is also the PDF on the desktop.</span>
        </p>
      ) : (
        <p className={styles.p}>The CV is on the desktop.</p>
      )}
    </Layout>
  );
}

/* The guestbook. Every home page had one, and it was the only part of the
 * page that talked back. The entries come from /api/guestbook (deploy/
 * guestbook/), which the dev server does not have - so the page says so
 * rather than showing an empty book. The "website" field is the honeypot:
 * hidden from people, filled in by bots, and the server drops anything that
 * has it. Text is rendered as text; nothing anyone types becomes markup. */
type GuestbookEntry = { id: string; name: string; message: string; date: string };

const GUESTBOOK_API = "/api/guestbook";

export function GuestbookPage({ url }: PageProps) {
  const [entries, setEntries] = useState<GuestbookEntry[] | null | "down">(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch(GUESTBOOK_API)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { entries: GuestbookEntry[] }) => live && setEntries(data.entries))
      .catch(() => live && setEntries("down"));
    return () => {
      live = false;
    };
  }, []);

  const sign = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setNote(null);
    try {
      const r = await fetch(GUESTBOOK_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, message, website }),
      });
      const data = (await r.json().catch(() => ({}))) as { entry?: GuestbookEntry; error?: string };
      if (!r.ok || !data.entry) {
        setNote(data.error ?? "The guestbook did not take that. Try again in a moment.");
        return;
      }
      const entry = data.entry;
      setEntries((was) => (Array.isArray(was) ? [entry, ...was] : [entry]));
      setMessage("");
      setNote("Thanks for signing!");
    } catch {
      setNote("The guestbook server is not answering.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout url={url} title="Guestbook">
      <p className={styles.p}>
        Sign my guestbook! Say hello, say where you found this, say what you think of the desktop. No account, no
        e-mail, no cookies &mdash; a name and a line, the way it was.
      </p>

      <form className={styles.guestForm} onSubmit={sign}>
        <table className={styles.facts}>
          <tbody>
            <tr>
              <td><label htmlFor="gb-name">Name</label></td>
              <td><input id="gb-name" className={styles.input} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Anonymous" /></td>
            </tr>
            <tr>
              <td><label htmlFor="gb-message">Message</label></td>
              <td>
                <textarea id="gb-message" className={styles.textarea} value={message} maxLength={500} rows={4} required onChange={(e) => setMessage(e.target.value)} />
              </td>
            </tr>
            <tr className={styles.honeypot} aria-hidden="true">
              <td><label htmlFor="gb-website">Website</label></td>
              <td><input id="gb-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></td>
            </tr>
            <tr>
              <td></td>
              <td>
                <button type="submit" className={styles.button} disabled={busy || entries === "down"}>
                  {busy ? "Signing..." : "Sign guestbook"}
                </button>
                {note && <span className={styles.guestNote}>{note}</span>}
              </td>
            </tr>
          </tbody>
        </table>
      </form>

      <h2 className={styles.h2}>What people wrote</h2>
      {entries === null && <p className={styles.small}>Loading&hellip;</p>}
      {entries === "down" && (
        <p className={styles.small}>
          The guestbook server is not answering. It runs next to the site (deploy/guestbook in the source), so on
          a copy without it there is nothing to read.
        </p>
      )}
      {Array.isArray(entries) && entries.length === 0 && (
        <p className={styles.small}>Nobody yet. Be the first!</p>
      )}
      {Array.isArray(entries) &&
        entries.map((en) => (
          <div key={en.id} className={styles.guestEntry}>
            <div className={styles.guestMessage}>{en.message}</div>
            <div className={styles.guestMeta}>
              &mdash; <b>{en.name}</b>, {longDate(en.date.slice(0, 10))}
            </div>
          </div>
        ))}
    </Layout>
  );
}

/* The blog: My Documents\My Blog, newest first. Each post is a file the
 * visitor can also find in Explorer, which is the point of keeping it there. */
export function BlogPage({ url }: PageProps) {
  const posts = usePosts();
  return (
    <Layout url={url} title="Blog">
      {posts.length === 0 && <p className={styles.p}>Nothing here yet. Check back soon!</p>}
      {posts.map((post) => (
        <div key={post.slug} className={styles.entry}>
          <div className={styles.entryHead}>
            <b><A href={postUrl(post)}>{post.title}</A></b>
            <span className={styles.entryWhen}>{longDate(post.date)}</span>
          </div>
          <p className={styles.p}>{post.summary}</p>
        </div>
      ))}
      <p className={styles.small}>
        Subscribe: <A href="https://khirokhito.tech/rss.xml">rss.xml</A>. The posts are also plain files in
        My Documents\My Blog.
      </p>
    </Layout>
  );
}

export function PostPage({ url }: PageProps) {
  const posts = usePosts();
  const navigate = useNavigate();
  const slug = url.slice("about:blog/".length);
  const post = posts.find((p) => p.slug === slug);
  if (!post) return <CannotDisplayPage url={url} />;
  const index = posts.indexOf(post);
  const newer = posts[index - 1];
  const older = posts[index + 1];
  return (
    <Layout url={url} title={post.title}>
      <p className={styles.small}>{longDate(post.date)}</p>
      <div className={styles.post}>
        <Markdown
          /* The title is the page's heading already; the post's own first
             heading, wherever the front matter left it, is dropped. */
          source={post.body.replace(/^\s*#\s+.*(\r?\n|$)/, "")}
          link={(href, children) => <A href={href}>{children}</A>}
        />
      </div>
      <hr className={styles.rule} />
      <p className={styles.small}>
        {older && <>&larr; <A href={postUrl(older)}>{older.title}</A></>}
        {older && newer && " · "}
        {newer && <><A href={postUrl(newer)}>{newer.title}</A> &rarr;</>}
        {(older || newer) && " · "}
        <a href="about:blog" className={styles.a} onClick={(e) => { e.preventDefault(); navigate("about:blog"); }}>
          All posts
        </a>
      </p>
    </Layout>
  );
}

export function BlankPage() {
  return <div className={styles.blank} />;
}

/* The one everybody remembers, word for word where it counts. The button at
 * the bottom is the one thing IE could not offer: the address works in the
 * browser this desktop is running in. */
export function CannotDisplayPage({ url }: PageProps) {
  return (
    <div className={styles.cannot}>
      <h1 className={styles.cannotTitle}>The page cannot be displayed</h1>
      <p>
        The page you are looking for is currently unavailable. The Web site might be experiencing technical
        difficulties, or you may need to adjust your browser settings.
      </p>
      <hr className={styles.cannotRule} />
      <p><b>Please try the following:</b></p>
      <ul>
        <li>Click the <b>Refresh</b> button, or try again later.</li>
        <li>If you typed the page address in the Address bar, make sure that it is spelled correctly.</li>
        <li>
          This Internet Explorer shows only the pages that live on this computer. Most Web sites refuse to be
          shown inside another page, so it does not pretend to.
        </li>
        <li>
          <button type="button" className={styles.button} onClick={() => openExternal(url)}>
            Open {url} in your browser
          </button>
        </li>
      </ul>
      <p className={styles.cannotFoot}>Cannot find server or DNS Error<br />Internet Explorer</p>
    </div>
  );
}
