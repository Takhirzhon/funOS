import { useMemo } from "react";
import { listEntries, useFsStore, type FsEntry } from "../store/fsStore";
import { MY_DOCUMENTS } from "../fs/seed";
import { basename, join } from "../fs/path";

/* The blog is a folder: My Documents\My Blog, Markdown files, one per post.
 *
 * A post is the file's text with an optional front matter block on top:
 *
 *   ---
 *   title: What the desktop is for
 *   date: 2026-09-16
 *   ---
 *   # What the desktop is for
 *   ...
 *
 * Title falls back to the first heading, then to the file name; date to the
 * file's modified time. The slug is the file name, lower case, punctuation
 * to dashes - the same rule portfolio.plugin.ts uses for rss.xml, so the
 * link in a feed reader is the link Internet Explorer opens.
 */

export const BLOG_DIR = join(MY_DOCUMENTS, "My Blog");

export type Post = {
  slug: string;
  title: string;
  /** YYYY-MM-DD. */
  date: string;
  /** The Markdown, front matter removed. */
  body: string;
  /** First paragraph, plain, for the list. */
  summary: string;
  entry: FsEntry;
};

export const slugOf = (stem: string): string =>
  stem
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const isPostEntry = (entry: FsEntry): boolean =>
  entry.kind === "file" && entry.path.startsWith(`${BLOG_DIR}/`) && entry.path.toLowerCase().endsWith(".md");

export function parsePost(entry: FsEntry): Post {
  const name = basename(entry.path);
  const stem = name.slice(0, -3);
  let body = entry.content;
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
  const summary =
    body
      .split(/\r?\n\s*\r?\n/)
      .map((p) => p.trim())
      .find((p) => p && !p.startsWith("#") && !p.startsWith("!")) ?? "";
  return {
    slug: slugOf(stem),
    title: meta.title ?? heading?.[1] ?? stem,
    date: meta.date ?? new Date(entry.modified).toISOString().slice(0, 10),
    body,
    summary: summary.replace(/[*_`>#[\]]/g, "").slice(0, 300),
    entry,
  };
}

/** Every post, newest first. */
export function usePosts(): Post[] {
  const entries = useFsStore((s) => s.entries);
  return useMemo(
    () =>
      listEntries(entries, BLOG_DIR)
        .filter(isPostEntry)
        .map(parsePost)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [entries]
  );
}

/** A post's address inside Internet Explorer. */
export const postUrl = (post: Post | FsEntry): string =>
  `about:blog/${"slug" in post ? post.slug : slugOf(basename(post.path).slice(0, -3))}`;
