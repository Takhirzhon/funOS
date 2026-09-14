/* Path arithmetic for the virtual file system.
 *
 * Two forms, deliberately:
 *
 *   canonical  "C:/Documents and Settings/User/My Documents/notes.txt"
 *   display    "C:\Documents and Settings\User\My Documents\notes.txt"
 *
 * Everything inside the program uses forward slashes, because splitting and
 * joining on one separator is the difference between this file being twenty
 * lines and being a source of bugs. Backslashes exist only where a user can see
 * them - the address bar, a title bar, a properties dialog.
 *
 * Pure functions, no store access: this is the one part of the file system that
 * is worth being able to reason about without running anything.
 */

/** The only drive that exists. Others are shown in My Computer and are empty. */
export const DRIVE = "C:";

/** Canonicalize. Accepts either separator, and either case of drive letter. */
export function normalize(input: string): string {
  let p = input.trim().replace(/\\/g, "/");

  /* A leading "/" means "the root of the only drive we have". Typing "/windows"
   * into the address bar should not be an error. */
  if (p.startsWith("/")) p = DRIVE + p;

  const match = /^([a-zA-Z]):(.*)$/.exec(p);
  const drive = match ? `${match[1].toUpperCase()}:` : DRIVE;
  const rest = match ? match[2] : p;

  const out: string[] = [];
  for (const segment of rest.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      out.pop();
      continue;
    }
    out.push(segment);
  }

  return out.length ? `${drive}/${out.join("/")}` : drive;
}

/** True for "C:" and nothing else - the top of a drive has no parent. */
export function isDriveRoot(path: string): boolean {
  return /^[A-Z]:$/.test(normalize(path));
}

export function dirname(path: string): string {
  const p = normalize(path);
  if (isDriveRoot(p)) return p;
  const cut = p.lastIndexOf("/");
  return cut <= 2 ? p.slice(0, 2) : p.slice(0, cut);
}

export function basename(path: string): string {
  const p = normalize(path);
  if (isDriveRoot(p)) return p;
  return p.slice(p.lastIndexOf("/") + 1);
}

export function join(base: string, ...segments: string[]): string {
  return normalize([base, ...segments].join("/"));
}

/** Every ancestor of a path, root first: C:, C:/a, C:/a/b. */
export function ancestors(path: string): string[] {
  const p = normalize(path);
  const out: string[] = [];
  let current = p;
  while (!isDriveRoot(current)) {
    out.unshift(current);
    current = dirname(current);
  }
  out.unshift(current);
  return out;
}

/** True if `child` is inside `parent` at any depth. Used by recursive delete. */
export function isInside(parent: string, child: string): boolean {
  const p = normalize(parent);
  const c = normalize(child);
  return c !== p && c.startsWith(p === DRIVE ? `${p}/` : `${p}/`);
}

/** What a person sees. The drive root gets its trailing slash back: "C:\". */
export function display(path: string): string {
  const p = normalize(path);
  return isDriveRoot(p) ? `${p}\\` : p.replace(/\//g, "\\");
}

/** ".txt" of "notes.txt", lower case, "" when there is no extension. */
export function extname(path: string): string {
  const name = basename(path);
  const dot = name.lastIndexOf(".");
  return dot <= 0 ? "" : name.slice(dot).toLowerCase();
}

/* Windows rejects these outright, and so should a rename box - silently
 * stripping them produces a file the user did not ask for and cannot find.
 */
const ILLEGAL = /[\\/:*?"<>|]/;

export function isValidName(name: string): boolean {
  const trimmed = name.trim();
  return (
    trimmed.length > 0 &&
    trimmed.length <= 255 &&
    !ILLEGAL.test(trimmed) &&
    trimmed !== "." &&
    trimmed !== ".."
  );
}
