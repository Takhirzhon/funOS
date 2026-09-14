/* A three-function IndexedDB wrapper, and no more than that.
 *
 * Why IndexedDB rather than localStorage, which would have been simpler: the
 * file system is the thing every later app writes into - Paint saves PNGs,
 * the media player wants audio - and localStorage is a ~5MB quota of UTF-16
 * strings with a synchronous API that blocks the main thread on every write.
 * IndexedDB has room and stays off the render path.
 *
 * Why it stores one blob under one key instead of a record per file: the whole
 * file system is a few kilobytes and is already held in memory by the store. A
 * per-file schema would buy incremental writes that nothing here is large
 * enough to need, and cost a migration the first time an Entry grows a field.
 *
 * Everything degrades to "no persistence" rather than throwing. Private-mode
 * Firefox refuses to open a database at all, and a desktop that will not boot
 * because it cannot remember your files is worse than one that forgets them.
 */

const DB_NAME = "funos";
const DB_VERSION = 1;
const STORE = "kv";

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    /* Another tab holding an older version open. Not worth blocking boot for. */
    request.onblocked = () => resolve(null);
  });

  return dbPromise;
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
      request.onsuccess = () => resolve(request.result as T | undefined);
      request.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}
