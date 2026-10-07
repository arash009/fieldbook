// Offline support: the app shell is cached per version; trip files are fetched fresh when there's signal.
const VERSION = '__VERSION__';
const SHELL = `fieldbook-shell-${VERSION}`;
const TRIPS = 'fieldbook-trips';
const PHOTOS = 'fieldbook-photos';
const ASSETS = ['./', './index.html', './app.js', './app.css', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './demo/trip.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('fieldbook-shell-') && k !== SHELL).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function networkFirst(request) {
  const cache = await caches.open(TRIPS);
  try {
    const response = await fetch(request, { cache: 'no-cache' });
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const hit = await cache.match(request, { ignoreSearch: true });
    if (hit) return hit;
    throw error;
  }
}

async function photo(request) {
  const cache = await caches.open(PHOTOS);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) { // guide photos are CORS requests, so a failed one is never kept
    try {
      await cache.put(request, res.clone());
      const keys = await cache.keys();
      for (const k of keys.slice(0, Math.max(0, keys.length - 150))) await cache.delete(k);
    } catch { /* storage full: the photo still shows, it just isn't kept */ }
  }
  return res;
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === 'GET' && url.hostname === 'upload.wikimedia.org') { event.respondWith(photo(event.request)); return; }
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.includes('/trips/')) { event.respondWith(networkFirst(event.request)); return; }
  event.respondWith(caches.match(event.request, { ignoreSearch: true }).then((hit) => hit ?? fetch(event.request)));
});
