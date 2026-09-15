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
    /* Dropping a file into the folder during `vite dev` should show up on the
     * desktop without a restart - the folder is the whole interface. */
    configureServer(server) {
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
