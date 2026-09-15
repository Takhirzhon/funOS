import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, extname } from "node:path";
import type { Plugin } from "vite";

/* The portfolio: real files, served by nginx, shown as part of C:\.
 *
 * Everything under public/portfolio/ mirrors the user's profile folder:
 *
 *   public/portfolio/Desktop/CV.pdf
 *     -> C:\Documents and Settings\User\Desktop\CV.pdf
 *   public/portfolio/My Documents/My Pictures/me.jpg
 *     -> C:\Documents and Settings\User\My Documents\My Pictures\me.jpg
 *
 * The file system itself lives in IndexedDB and is seeded exactly once, so a
 * returning visitor never sees a file added to the seed later. These are
 * different: the manifest is compiled into the bundle, laid over the stored
 * tree on every load, and never written back - which is what makes "replace
 * CV.pdf and deploy" reach everyone, including people who were here last year.
 *
 * Built at compile time rather than fetched at runtime so that Explorer knows
 * the sizes and dates before anything has been downloaded, and so that a text
 * file (About Me.txt) can be shown in Notepad without a round trip.
 */

const ROOT = "public/portfolio";
const URL_BASE = "/portfolio";

/* Skipped at the top level only: the README explains the folder to whoever
 * opens the repository, not to a visitor. */
const IGNORED = new Set(["README.md", ".gitkeep", ".DS_Store", "Thumbs.db"]);

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".txt": "text/plain",
  ".md": "text/markdown",
};

/* Inlined into the bundle rather than fetched. Bounded, because the entry
 * chunk is budgeted and a text file is the one kind that lands in it. */
const INLINE_TEXT_LIMIT = 64 * 1024;

export type PortfolioFile = {
  /** Relative to the profile folder, forward slashes: "Desktop/CV.pdf". */
  path: string;
  mime: string;
  size: number;
  modified: number;
  /** Where nginx serves it. Absent for text, which is carried inline. */
  url?: string;
  /** The text itself, for files small enough to ship in the bundle. */
  content?: string;
};

function scan(dir: string, out: PortfolioFile[]): void {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of names.sort()) {
    const full = join(dir, name);
    const rel = relative(ROOT, full).split("\\").join("/");
    if (rel === name && IGNORED.has(name)) continue;
    if (name.startsWith(".")) continue;

    const stat = statSync(full);
    if (stat.isDirectory()) {
      scan(full, out);
      continue;
    }

    const mime = MIME[extname(name).toLowerCase()] ?? "application/octet-stream";
    const file: PortfolioFile = { path: rel, mime, size: stat.size, modified: stat.mtimeMs };

    if (mime.startsWith("text/") && stat.size <= INLINE_TEXT_LIMIT) {
      file.content = readFileSync(full, "utf8");
    } else {
      /* encodeURI, not encodeURIComponent per segment: the latter turns a
       * comma into %2C, which nginx decodes and Vite's dev server does not -
       * "Ratsek, June 2026.jpg" was a photograph in production and index.html
       * in development. encodeURI leaves the characters a path may contain
       * alone; the two it must not, it does not know about. */
      file.url = `${URL_BASE}/${encodeURI(rel).replace(/[#?]/g, encodeURIComponent)}`;
    }
    out.push(file);
  }
}

const VIRTUAL_ID = "virtual:portfolio";
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

/* ---- The blog, as seen from outside ---------------------------------------
 *
 * Posts are Markdown files under My Documents/My Blog, read inside Internet
 * Explorer at about:blog. A feed reader and a search engine cannot open a
 * window, so the same folder is also turned into rss.xml and sitemap.xml at
 * build time, with each post linked as a hash the desktop opens on load.
 * The front matter parser is the same few lines as src/blog/posts.ts; the
 * plugin runs in node and the pages in the browser, and sharing a module
 * across that line is not worth the build plumbing.
 */
const SITE = "https://khirokhito.tech";
const BLOG_DIR = "My Documents/My Blog/";

type Post = { slug: string; title: string; date: string; summary: string };

const slugOf = (stem: string) =>
  stem
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function parsePost(file: PortfolioFile): Post | null {
  if (!file.path.startsWith(BLOG_DIR) || !file.path.endsWith(".md") || !file.content) return null;
  const stem = file.path.slice(BLOG_DIR.length, -3);
  let body = file.content;
  const meta: Record<string, string> = {};
  const fm = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(body);
  if (fm) {
    for (const line of fm[1].split(/\r?\n/)) {
      const m = /^(\w+):\s*(.*)$/.exec(line);
      if (m) meta[m[1].toLowerCase()] = m[2].trim();
    }
    body = body.slice(fm[0].length);
  }
  const heading = /^#\s+(.+)$/m.exec(body);
  const title = meta.title ?? heading?.[1] ?? stem;
  const date = meta.date ?? new Date(file.modified).toISOString().slice(0, 10);
  const summary =
    body
      .split(/\r?\n\s*\r?\n/)
      .map((p) => p.trim())
      .find((p) => p && !p.startsWith("#") && !p.startsWith("!")) ?? "";
  return { slug: slugOf(stem), title, date, summary: summary.replace(/[*_`>#[\]]/g, "").slice(0, 300) };
}

const escapeXml = (s: string) =>
  s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

function feeds(files: PortfolioFile[]): { rss: string; sitemap: string } {
  const posts = files
    .map(parsePost)
    .filter((p): p is Post => p !== null)
    .sort((a, b) => b.date.localeCompare(a.date));
  const link = (p: Post) => `${SITE}/#about:blog/${p.slug}`;

  const items = posts
    .map(
      (p) => `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${link(p)}</link>
      <guid isPermaLink="true">${link(p)}</guid>
      <pubDate>${new Date(`${p.date}T12:00:00Z`).toUTCString()}</pubDate>
      <description>${escapeXml(p.summary)}</description>
    </item>`
    )
    .join("\n");

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Tokhirzhon Tashmatov</title>
    <link>${SITE}/</link>
    <description>Notes from an AI/ML engineer in Bishkek, read in Internet Explorer 6.</description>
    <language>en</language>
    <atom:link href="${SITE}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

  const urls = posts
    .map(
      (p) => `  <url>
    <loc>${escapeXml(link(p))}</loc>
    <lastmod>${p.date}</lastmod>
    <priority>0.6</priority>
  </url>`
    )
    .join("\n");

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
${urls}
</urlset>
`;
  return { rss, sitemap };
}

export function portfolio(): Plugin {
  return {
    name: "funos-portfolio",
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
    },
    load(id) {
      if (id !== RESOLVED_ID) return undefined;
      const files: PortfolioFile[] = [];
      scan(ROOT, files);
      return `export const files = ${JSON.stringify(files)};`;
    },
    /* The feed and the sitemap ride along with the build as if they had been
     * in public/. */
    generateBundle() {
      const files: PortfolioFile[] = [];
      scan(ROOT, files);
      const { rss, sitemap } = feeds(files);
      this.emitFile({ type: "asset", fileName: "rss.xml", source: rss });
      this.emitFile({ type: "asset", fileName: "sitemap.xml", source: sitemap });
    },
    /* Dropping a file into the folder during `vite dev` should show up on the
     * desktop without a restart - the folder is the whole interface. The feed
     * and sitemap are served here too, so they can be checked before a deploy. */
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== "/rss.xml" && req.url !== "/sitemap.xml") return next();
        const files: PortfolioFile[] = [];
        scan(ROOT, files);
        const { rss, sitemap } = feeds(files);
        res.setHeader("Content-Type", req.url === "/rss.xml" ? "application/rss+xml" : "application/xml");
        res.end(req.url === "/rss.xml" ? rss : sitemap);
      });
      const root = join(server.config.root, ROOT);
      server.watcher.add(root);
      server.watcher.on("all", (_event, file) => {
        if (!file.startsWith(root)) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: "full-reload" });
      });
    },
  };
}
