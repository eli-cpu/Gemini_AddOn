// Tiny IndexedDB key/value store for secrets (the Gemini API key).
//
// Why not chrome.storage.local? It is readable by content scripts, which
// run inside the gemini.google.com renderer process. IndexedDB here belongs
// to the extension origin (chrome-extension://<id>), so only the popup and
// the service worker can open it – never a web page or a content script.
//
// Note: like all browser storage it is not encrypted on disk.

const DB_NAME = "ga-secrets";
const STORE = "kv";

const idb = () => globalThis.indexedDB;

export const hasSecretStore = () => !!idb();

function openDb() {
  return new Promise((resolve, reject) => {
    const req = idb().open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run(mode, fn) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req?.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export const getSecret = (name) => run("readonly", (store) => store.get(name));
export const setSecret = (name, value) => run("readwrite", (store) => store.put(value, name));
export const deleteSecret = (name) => run("readwrite", (store) => store.delete(name));
