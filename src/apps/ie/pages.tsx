import { useState, type ReactNode } from "react";
import { blobUrlFor, listEntries, useFsStore } from "../../store/fsStore";
import { DESKTOP_DIR, MY_DOCUMENTS } from "../../fs/seed";
import { join } from "../../fs/path";
import { launchFile } from "../../fs/open";
import { EMAIL, LINKS, openExternal, useNavigate } from "./site";
import { postUrl, usePosts } from "../../blog/posts";
import { Markdown } from "./Markdown";
import styles from "./pages.module.css";

/* The home page, as one was in 2004: a table with a menu down the left, a
 * photograph with a bevelled border, Verdana at 12px, a visitor counter, and
 * "best viewed at 800x600" at the bottom. Hand-written, the way they were.
 *
 * Everything on it is from the CV on the desktop. When that changes, this is
 * the other place to change.
 */

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
  ["about:contact", "Contact"],
] as const;

/* A date the way a 2004 page wrote one: "16 September 2026". */
const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

function Layout({ url, title, children }: PageProps & { title: string; children: ReactNode }) {
  /* The Blog entry stays lit on a post's page too. */
  const section = url.startsWith("about:blog") ? "about:blog" : url;
  return (
    <div className={styles.site}>
      <div className={styles.masthead}>
        <span className={styles.mastName}>Tokhirzhon Tashmatov</span>
        <span className={styles.mastSub}>AI/ML engineer &middot; Bishkek, Kyrgyzstan</span>
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
        <span>&copy; 2004&ndash;{new Date().getFullYear()} Tokhirzhon Tashmatov. Best viewed at 800&times;600 in Internet Explorer 6.</span>
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

function usePortrait(): string | undefined {
  const entries = useFsStore((s) => s.entries);
  const pictures = join(MY_DOCUMENTS, "My Pictures");
  const preferred = entries[join(pictures, "CyberSafe, senior year.jpg")];
  const first = listEntries(entries, pictures).find((e) => e.mime?.startsWith("image/"));
  const entry = preferred ?? first;
  return entry ? blobUrlFor(entry) : undefined;
}

export function HomePage({ url }: PageProps) {
  const hits = useHitCounter();
  const portrait = usePortrait();
  return (
    <Layout url={url} title="Welcome to my home page!">
      <div className={styles.intro}>
        {portrait && <img src={portrait} alt="Tokhirzhon" className={styles.portrait} />}
        <div>
          <p>
            Hello, and thanks for stopping by. I am an AI/ML engineer from Bishkek. I ship production LLM
            applications end to end &mdash; agents, RAG, retrieval &mdash; and I build the adversarial
            evaluation and red-teaming tooling that stress-tests them and measures where they fail.
          </p>
          <p>
            Strong Python and data-engineering foundation. Bias toward building, testing and measuring
            what actually works.
          </p>
          <p>
            Right now I am a Machine Learning / AI Engineer at <b>ConeRed</b> (remote, Spain). Before that:
            data engineering at EPAM, backend at Premium Soft, Android at Makers. The whole story is under{" "}
            <A href="about:work">Work</A>; the things I build for fun and on purpose are under{" "}
            <A href="about:projects">Projects</A>.
          </p>
        </div>
      </div>

      <h2 className={styles.h2}>What&rsquo;s new</h2>
      <ul className={styles.list}>
        <li>
          <b>injection-shield</b> is on PyPI &mdash; 75 adversarial prompt-injection attacks against any HTTP chat
          endpoint, with layered detection and a reproducible verdict report.{" "}
          <A href="https://github.com/Takhirzhon/Aegis-Security">GitHub</A>
        </li>
        <li>
          <b>GRANAT</b>, the choir-synthesis pipeline I lead, mixes phone-recorded solo takes from many singers
          into one studio track. <A href="about:projects">More</A>
        </li>
        <li>
          Graduated from the American University of Central Asia, B.A. in Software Engineering, on a full-ride
          U.S.-CAEF scholarship.
        </li>
        <li>
          This site is a Windows XP desktop that runs in your browser. The CV is on the desktop; the photographs
          are in My Pictures. Source on <A href="https://github.com/Takhirzhon/funOS">GitHub</A>.
        </li>
      </ul>

      <h2 className={styles.h2}>Quick facts</h2>
      <table className={styles.facts}>
        <tbody>
          <tr><td>Location</td><td>Bishkek, Kyrgyzstan (remote-friendly)</td></tr>
          <tr><td>Languages</td><td>Python, TypeScript, SQL, Kotlin, C/C++</td></tr>
          <tr><td>Spoken</td><td>English (C1), Russian, Kyrgyz, Uzbek, Tajik (basic)</td></tr>
          <tr><td>Education</td><td>B.A. Software Engineering, AUCA &middot; exchange at AUBG (Bulgaria)</td></tr>
          <tr><td>Honors</td><td>Winner, Cyber-Security Hackathon &middot; FLEX finalist &middot; 1st place, National Technology Creation Olympiad</td></tr>
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

const WORK = [
  {
    role: "Machine Learning / AI Engineer",
    org: "ConeRed",
    where: "Remote (Spain)",
    when: "Jul 2025 – present",
    points: [
      "Built and open-sourced an LLM red-teaming toolkit: 75 adversarial prompt-injection attacks against any HTTP chat endpoint, layered detection (regex + vector similarity + ML classifier + LLM-as-judge), reproducible verdict report.",
      "Architected a multi-service AI knowledge platform (FastAPI, Next.js/TS, PostgreSQL, Redis, Qdrant, Celery) as a containerized docker-compose stack with nginx TLS ingress.",
      "Built LangGraph agent pipelines (context → summarize → intent → retrieval → response) over Voyage embeddings in Qdrant, serving multilingual real-time Q&A to 3,500+ users across web, Telegram and an embeddable widget.",
      "Engineered an agentic backend for autonomous B2B research and outreach with tool-use over LinkedIn, Perplexity and web scraping, auto-generating scored reports into Google Docs/Sheets.",
    ],
  },
  {
    role: "Data Engineer",
    org: "EPAM Systems",
    where: "Bishkek (hybrid)",
    when: "Jun 2024 – Dec 2024",
    points: [
      "Designed and maintained ETL pipelines processing 500 GB/day of log data in Python + SQL on PostgreSQL.",
      "Cut query latency 22% on high-load services by optimizing schemas, indexes and rewriting queries from measured plans; built FastAPI data-retrieval and pipeline-monitoring tools.",
    ],
  },
  {
    role: "Backend Developer",
    org: "Premium Soft",
    where: "Remote (Sofia, Bulgaria)",
    when: "Jan 2024 – May 2024",
    points: [
      "FastAPI backend services for AI-powered internal products; REST APIs for data ingestion, processing and LLM inference pipelines integrated into existing systems.",
    ],
  },
  {
    role: "Android Developer",
    org: "Makers Incubator",
    where: "Bishkek",
    when: "Jun 2023 – Nov 2023",
    points: [
      "Android e-learning app (Kotlin, Firebase) that lifted course registrations 30%; led full-cycle development and cut delivery time 20%.",
    ],
  },
];

export function WorkPage({ url }: PageProps) {
  return (
    <Layout url={url} title="Work">
      {WORK.map((job) => (
        <div key={job.org} className={styles.entry}>
          <div className={styles.entryHead}>
            <b>{job.role}</b> &mdash; {job.org}
            <span className={styles.entryWhen}>{job.when} &middot; {job.where}</span>
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
        <li><b>American University of Central Asia</b> &mdash; B.A. in Software Engineering, 2021–2025. Full-ride U.S.-CAEF scholarship (top 1% of applicants).</li>
        <li><b>American University in Bulgaria</b> &mdash; exchange semester in Computer Science, 2024. OSUN Mobility Scholarship.</li>
      </ul>
      <p className={styles.small}>
        The full CV is on the desktop &mdash; <A href="about:contact">download it here</A>.
      </p>
    </Layout>
  );
}

const PROJECTS = [
  {
    name: "GRANAT",
    tag: "Tech Lead · Python, DSP/ML",
    text: "Choir-synthesis and vocal-alignment pipeline for a well-known recording artist's music project: aligns and mixes phone-recorded solo vocal takes from many singers into a coherent studio track (onset-envelope DTW + WSOLA time-stretch, ECAPA-TDNN speaker embeddings, Whisper alignment). I own the architecture, roadmap and delivery.",
  },
  {
    name: "Aegis Security / injection-shield",
    tag: "Python, FastAPI · GPLv3 on PyPI",
    href: "https://github.com/Takhirzhon/Aegis-Security",
    text: "Open-source AI-security platform. The injection-shield module runs 75 adversarial prompt-injection attacks with stacked detection (regex + embeddings + ML classifier + LLM-as-judge) and reproducible reporting, with a browser GUI.",
  },
  {
    name: "GeoGuard",
    tag: "Python, ML · Apache-2.0",
    href: "https://github.com/Takhirzhon/GeoGuard",
    text: "AI geospatial landslide and mudflow prediction for southern Kyrgyzstan: XGBoost/RF/NB over 17 terrain features plus CNNs on satellite imagery. Tabular AUC > 0.94; EfficientNetB0 at 85.4% on imagery alone. Also my bachelor's thesis, published on ResearchGate.",
  },
  {
    name: "CoVibeCode",
    tag: "Contributor · Tauri v2, Svelte 5, Rust",
    text: "Local-first desktop client that runs and manages AI coding agents (Claude Code, Codex) on your own machine.",
  },
  {
    name: "Randevu",
    tag: "Solo founder · Next.js, FastAPI",
    text: "Intent-based social matching as a Telegram Mini App: 15-question profiling, embedding + LLM matching with \"why you match\" explanations. Native iOS/Android in progress.",
  },
  {
    name: "funOS",
    tag: "React 19, TypeScript",
    href: "https://github.com/Takhirzhon/funOS",
    text: "The Windows XP you are looking at. A virtual file system in IndexedDB, a window manager, a dozen applications, and a 120KB budget on the shell that has held.",
  },
];

export function ProjectsPage({ url }: PageProps) {
  return (
    <Layout url={url} title="Projects & open source">
      {PROJECTS.map((p) => (
        <div key={p.name} className={styles.entry}>
          <div className={styles.entryHead}>
            <b>{p.href ? <A href={p.href}>{p.name}</A> : p.name}</b>
            <span className={styles.entryWhen}>{p.tag}</span>
          </div>
          <p className={styles.p}>{p.text}</p>
        </div>
      ))}
      <h2 className={styles.h2}>Skills, for the search engines</h2>
      <p className={styles.p}>
        <b>LLM / AI:</b> RAG, GraphRAG, LangGraph agents, tool-calling, structured outputs, LLM-as-judge evals,
        prompt-injection defense; OpenAI, Anthropic, Gemini, OpenRouter, Voyage, JINA.{" "}
        <b>Backend:</b> FastAPI, Flask, Pydantic, SQLAlchemy, Alembic, Celery.{" "}
        <b>Data &amp; infra:</b> PostgreSQL, Redis, Qdrant, Pinecone, FalkorDB, ETL, Docker, GitHub Actions, nginx,
        AWS, GCP. <b>Frontend:</b> React, Next.js, Tailwind.
      </p>
    </Layout>
  );
}

export function ContactPage({ url }: PageProps) {
  const entries = useFsStore((s) => s.entries);
  const cv = listEntries(entries, DESKTOP_DIR).find((e) => e.mime === "application/pdf");
  return (
    <Layout url={url} title="Contact">
      <p className={styles.p}>The best way to reach me is e-mail. I answer.</p>
      <table className={styles.facts}>
        <tbody>
          <tr><td>E-mail</td><td><A href={`mailto:${EMAIL}`}>{EMAIL}</A></td></tr>
          {LINKS.map((l) => (
            <tr key={l.href}><td>{l.label}</td><td><A href={l.href}>{l.href.replace(/^https?:\/\//, "")}</A></td></tr>
          ))}
        </tbody>
      </table>
      <h2 className={styles.h2}>Curriculum vitae</h2>
      {cv ? (
        <p className={styles.p}>
          <button type="button" className={styles.button} onClick={() => launchFile(cv)}>
            Open {cv.path.slice(cv.path.lastIndexOf("/") + 1)}
          </button>{" "}
          <span className={styles.small}>&mdash; it is also the PDF on the desktop.</span>
        </p>
      ) : (
        <p className={styles.p}>The CV is on the desktop.</p>
      )}
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
