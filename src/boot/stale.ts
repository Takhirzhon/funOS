/* A chunk that failed to load is a stale build - a deploy replaced the
 * files while the tab was open - and the fix is a reload. Once, so that a
 * real outage does not loop. */

const RELOAD_KEY = "funos.reloaded";

const isStaleChunk = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return /dynamically imported module|Importing a module script failed|Loading chunk|Loading CSS chunk|preload/i.test(message);
};

/** Reloads for a stale build, once per tab. Returns whether it did. */
export function reloadIfStale(error: unknown): boolean {
  if (!isStaleChunk(error)) return false;
  try {
    if (sessionStorage.getItem(RELOAD_KEY) === "1") return false;
    sessionStorage.setItem(RELOAD_KEY, "1");
  } catch {
    /* Private mode: reload anyway, once is not enforceable. */
  }
  window.location.reload();
  return true;
}


/* A page that has run for a minute is not the one that was stale; the
 * next deploy may reload it again. */
window.setTimeout(() => {
  try {
    sessionStorage.removeItem(RELOAD_KEY);
  } catch {
    /* Private mode. */
  }
}, 60_000);
