// Keeps each trip's derived key in IndexedDB. The key is non-extractable, so it can't be read back out.
const DB = 'fieldbook';
const STORE = 'keys';

function db() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run(mode, fn) {
  const conn = await db();
  return new Promise((resolve, reject) => {
    const tx = conn.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveKey(tripId, key, salt) {
  try { await run('readwrite', (s) => s.put({ key, salt }, tripId)); } catch { /* no IndexedDB: ask for the passphrase next time */ }
}

export async function loadKey(tripId) {
  try { return (await run('readonly', (s) => s.get(tripId))) ?? null; } catch { return null; }
}

export async function forgetKey(tripId) {
  try { await run('readwrite', (s) => s.delete(tripId)); } catch { /* nothing stored */ }
}
