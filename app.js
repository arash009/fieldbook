(() => {
'use strict';
const __fb = {};
__fb["clock.js"] = (() => {
// Time in the trip's own time zone, whatever zone the phone's clock is set to.

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const two = (n) => String(n).padStart(2, '0');
const utcDay = (date) => {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

function toMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function fromMinutes(mins) {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440;
  return `${two(Math.floor(m / 60))}:${two(m % 60)}`;
}

const weekdayOf = (date) => new Date(utcDay(date)).getUTCDay();

function addDays(date, n) {
  const t = new Date(utcDay(date) + n * 86400000);
  return `${t.getUTCFullYear()}-${two(t.getUTCMonth() + 1)}-${two(t.getUTCDate())}`;
}

const daysBetween = (a, b) => Math.round((utcDay(b) - utcDay(a)) / 86400000);

const makeLocal = (date, time) => ({ date, time, minutes: toMinutes(time), weekday: weekdayOf(date) });

function localNow(timeZone, at = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(at);
  const get = (type) => parts.find((p) => p.type === type).value;
  return makeLocal(`${get('year')}-${get('month')}-${get('day')}`, `${get('hour')}:${get('minute')}`);
}

function parseNowOverride(value) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(value ?? '');
  return m ? makeLocal(m[1], m[2]) : null;
}

function tripPhase(meta, now) {
  if (now.date < meta.startDate) return 'before';
  if (now.date > meta.endDate) return 'after';
  return 'during';
}

function formatDay(date) {
  const [, m, d] = date.split('-').map(Number);
  return `${WEEKDAYS[weekdayOf(date)]} ${d} ${MONTHS[m - 1]}`;
}

function formatDate(date) {
  const [y, m, d] = date.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

return { toMinutes, fromMinutes, weekdayOf, addDays, daysBetween, makeLocal, localNow, parseNowOverride, tripPhase, formatDay, formatDate };
})();
__fb["weather.js"] = (() => {
// Daily forecast from Open-Meteo (no key needed), mapped to what the day header shows.
const CODES = [[0, '☀', 'Clear'], [1, '🌤', 'Mostly clear'], [2, '⛅', 'Partly cloudy'], [3, '☁', 'Cloudy'], [45, '🌫', 'Fog'], [51, '🌦', 'Drizzle'], [61, '🌧', 'Rain'], [71, '🌨', 'Snow'], [80, '🌦', 'Showers'], [95, '⛈', 'Thunderstorm']];

function describeWeather(code) {
  let pick = CODES[0];
  for (const c of CODES) if (code >= c[0]) pick = c;
  return { icon: pick[1], text: pick[2] };
}

function forecastUrl(city, timezone, start, end) {
  const u = new URL('https://api.open-meteo.com/v1/forecast');
  u.search = new URLSearchParams({ latitude: city.lat, longitude: city.lng, timezone, start_date: start, end_date: end,
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunset' }).toString();
  return u.toString();
}

function parseForecast(json) {
  const d = json?.daily;
  const out = {};
  (d?.time ?? []).forEach((date, i) => {
    const code = d.weather_code?.[i];
    if (code == null || d.temperature_2m_max?.[i] == null) return;
    out[date] = { ...describeWeather(code), max: Math.round(d.temperature_2m_max[i]), min: Math.round(d.temperature_2m_min[i]), rain: d.precipitation_probability_max?.[i] ?? null, sunset: d.sunset?.[i]?.slice(11, 16) ?? null };
  });
  return out;
}

return { describeWeather, forecastUrl, parseForecast };
})();
__fb["crypto.js"] = (() => {
// Passphrase encryption for trip files. The same code runs in the browser and in Node 22.
const ITERATIONS = 600000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const subtle = () => globalThis.crypto.subtle;

function toBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function randomBytes(n) {
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i += 65536) globalThis.crypto.getRandomValues(out.subarray(i, i + 65536));
  return out;
}

async function deriveKey(passphrase, salt, iterations = ITERATIONS) {
  const base = await subtle().importKey('raw', encoder.encode(passphrase.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

async function sealWithKey(data, key, salt, iterations = ITERATIONS) {
  const iv = randomBytes(12);
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(JSON.stringify(data))));
  return { fieldbook: 1, kdf: 'PBKDF2-SHA256', iterations, salt: toBase64(salt), iv: toBase64(iv), data: toBase64(ct) };
}

async function seal(data, passphrase, { salt = randomBytes(16), iterations = ITERATIONS } = {}) {
  return sealWithKey(data, await deriveKey(passphrase, salt, iterations), salt, iterations);
}

async function openWithKey(envelope, key) {
  const plain = await subtle().decrypt({ name: 'AES-GCM', iv: fromBase64(envelope.iv) }, key, fromBase64(envelope.data));
  return JSON.parse(decoder.decode(plain));
}

async function open(envelope, passphrase) {
  const key = await deriveKey(passphrase, fromBase64(envelope.salt), envelope.iterations);
  return { key, data: await openWithKey(envelope, key) };
}

async function sealBytes(bytes, key) {
  const iv = randomBytes(12);
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, key, bytes));
  return { fieldbook: 1, kind: 'file', iv: toBase64(iv), data: toBase64(ct) };
}

async function openBytes(envelope, key) {
  return new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: fromBase64(envelope.iv) }, key, fromBase64(envelope.data)));
}

return { ITERATIONS, toBase64, fromBase64, randomBytes, deriveKey, sealWithKey, seal, openWithKey, open, sealBytes, openBytes };
})();
__fb["ticket-viewer.js"] = (() => {
// Full-screen ticket viewer outside #app. PDFs are drawn to canvases with PDF.js, loaded only when needed.
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
// cdnjs's published SRI hashes for these exact files (checked against the downloaded bytes).
const SRI = { lib: 'sha512-q+4liFwdPC/bNdhUpZx6aXDx/h77yEQtn4I1slHydcbZK34nLaR3cAeYSJshoxIOq3mjEf7xJE8YWIUHMn+oCQ==', worker: 'sha512-BbrZ76UNZq5BhH7LL7pn9A4TKQpQeNCHOo65/akfelcIBbcVvYWOFQKPXIrykE3qZxYjmDX573oa4Ywsc7rpTw==' };
// Keeps a load that worked; forgets one that failed, so "Try again" really tries again once there's signal.
function retryable(load) {
  let pending = null;
  return () => (pending ??= load().catch((e) => { pending = null; throw e; }));
}

const loadPdfJs = retryable(() => new Promise((ok, fail) => {
  if (globalThis.pdfjsLib) { ok(globalThis.pdfjsLib); return; }
  const s = document.createElement('script');
  s.src = PDFJS; s.integrity = SRI.lib; s.crossOrigin = 'anonymous';
  s.onload = () => ok(globalThis.pdfjsLib);
  s.onerror = () => { s.remove(); fail(new Error('PDF viewer failed to load')); };
  document.head.append(s);
}).then(async (lib) => {
  const res = await fetch(WORKER, { integrity: SRI.worker });
  if (!res.ok) throw new Error('PDF viewer failed to load');
  lib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([await res.text()], { type: 'text/javascript' }));
  return lib;
}));

function openTicketViewer({ ticket, load, onClose }) {
  const box = document.createElement('div');
  box.className = 'tv';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.innerHTML = '<div class="tv-bar"><b class="tv-title"></b><button class="btn small tv-ext" type="button">Open in phone viewer</button><button class="btn small p tv-close" type="button">Close</button></div><div class="tv-pages"><p class="tv-msg">Opening…</p></div>';
  box.querySelector('.tv-title').textContent = ticket.label;
  document.body.append(box);
  let url = null;
  const close = () => { if (url) URL.revokeObjectURL(url); box.remove(); onClose?.(); };
  box.querySelector('.tv-close').onclick = close;
  const pages = box.querySelector('.tv-pages');
  const fail = (msg) => { pages.innerHTML = ''; const p = document.createElement('p'); p.className = 'tv-msg'; p.textContent = msg; const retry = document.createElement('button'); retry.className = 'btn'; retry.textContent = 'Try again'; retry.onclick = () => { close(); openTicketViewer({ ticket, load, onClose }); }; pages.append(p, retry); };
  load().then(async (bytes) => {
    url = URL.createObjectURL(new Blob([bytes], { type: ticket.mime }));
    box.querySelector('.tv-ext').onclick = () => { if (confirmExternal(box)) window.open(url, '_blank'); };
    pages.innerHTML = '';
    if (ticket.mime !== 'application/pdf') { const img = document.createElement('img'); img.src = url; img.alt = ticket.label; pages.append(img); return; }
    const lib = await loadPdfJs();
    const doc = await lib.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const scale = (pages.clientWidth * devicePixelRatio) / page.getViewport({ scale: 1 }).width;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width; canvas.height = viewport.height;
      pages.append(canvas);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    }
  }).catch(() => fail("Couldn't open this ticket. Check your signal and try again."));
}

function confirmExternal(box) {
  const note = box.querySelector('.tv-warn');
  if (note) return true;
  const p = document.createElement('p');
  p.className = 'tv-warn';
  p.textContent = 'The phone may save a copy of the ticket to Downloads. Tap again to open it anyway.';
  box.querySelector('.tv-bar').after(p);
  return false;
}

return { retryable, openTicketViewer };
})();
__fb["keystore.js"] = (() => {
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

async function saveKey(tripId, key, salt) {
  try { await run('readwrite', (s) => s.put({ key, salt }, tripId)); } catch { /* no IndexedDB: ask for the passphrase next time */ }
}

async function loadKey(tripId) {
  try { return (await run('readonly', (s) => s.get(tripId))) ?? null; } catch { return null; }
}

async function forgetKey(tripId) {
  try { await run('readwrite', (s) => s.delete(tripId)); } catch { /* nothing stored */ }
}

return { saveKey, loadKey, forgetKey };
})();
__fb["ticks.js"] = (() => {
// Things ticked off on this phone (stops done, bookings made), kept per trip.
const keyFor = (tripId) => `fieldbook:ticks:${tripId}`;

function loadTicks(tripId, storage = globalThis.localStorage) {
  try { return new Set(JSON.parse(storage.getItem(keyFor(tripId)) ?? '[]')); } catch { return new Set(); }
}

function saveTicks(tripId, ticks, storage = globalThis.localStorage) {
  try { storage.setItem(keyFor(tripId), JSON.stringify([...ticks])); } catch { /* storage unavailable: ticks last for this session */ }
}

function toggleTick(ticks, id) {
  const next = new Set(ticks);
  if (next.has(id)) next.delete(id); else next.add(id);
  return next;
}

return { loadTicks, saveTicks, toggleTick };
})();
__fb["data.js"] = (() => {
// Normalises a decrypted payload for the views, and moves the demo's dates to start today.
const { addDays } = __fb["clock.js"];

function indexPayload(payload) {
  const t = payload.transport ?? {};
  const boards = Object.fromEntries(Object.entries(t.boards ?? {}).map(([id, b]) => [id, { ...b, id }]));
  return {
    trip: payload.trip,
    guides: payload.guides ?? [],
    transport: { checked: t.checked, routes: t.routes ?? {}, services: t.services ?? {}, lines: t.lines ?? {}, boards, liveStatus: t.liveStatus ?? {} },
    private: { stays: payload.private?.stays ?? {}, config: payload.private?.config ?? {}, tickets: payload.private?.tickets ?? [] },
  };
}

function rebaseDates(value, offset) {
  // Dates, and keys that start with a date such as a dining reference "2030-06-01/lunch".
  if (typeof value === 'string') return value.replace(/^(\d{4}-\d{2}-\d{2})(?=$|\/)/, (d) => addDays(d, offset));
  if (Array.isArray(value)) return value.map((v) => rebaseDates(v, offset));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rebaseDates(v, offset)]));
  return value;
}

return { indexPayload, rebaseDates };
})();
__fb["router.js"] = (() => {
// Hash routes: #/today, #/days, #/day/<date>, #/stop/<id>, #/bookings, #/guide[/<id>], #/info[/<card>].
function parseRoute(hash) {
  const parts = (hash ?? '').replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean).map(decodeURIComponent);
  const [head, arg] = parts;
  if (head === 'days') return { name: 'days', params: {} };
  if (head === 'day' && arg) return { name: 'day', params: { date: arg } };
  if (head === 'stop' && arg) return { name: 'stop', params: { id: arg } };
  if (head === 'bookings') return { name: 'bookings', params: {} };
  if (head === 'guide') return arg ? { name: 'guideItem', params: { id: arg } } : { name: 'guide', params: {} };
  if (head === 'info') return arg ? { name: 'infoCard', params: { id: arg } } : { name: 'info', params: {} };
  return { name: 'today', params: {} };
}

// One-off links: #open=<trip id> remembers a trip, #demo starts the sample trip.
function parseSpecialHash(hash) {
  const open = /^#open=([a-z0-9]{4,32})$/i.exec(hash ?? '');
  if (open) return { open: open[1].toLowerCase() };
  return hash === '#demo' ? { demo: true } : null;
}

return { parseRoute, parseSpecialHash };
})();
__fb["html.js"] = (() => {
// Escaping HTML templates and small safety helpers. Data never reaches the page unescaped.
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

class Raw {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}
const raw = (s) => new Raw(String(s));

function renderValue(v) {
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(renderValue).join('');
  if (v === null || v === undefined || v === false) return '';
  return esc(v);
}

function html(strings, ...values) {
  let out = strings[0];
  values.forEach((v, i) => { out += renderValue(v) + strings[i + 1]; });
  return new Raw(out);
}

const mapsUrl = (query) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
const safeUrl = (u) => (typeof u === 'string' && /^https:\/\/[^\s"'<>]+$/.test(u) ? u : null);
const hexColour = (c) => (/^#[0-9a-f]{6}$/i.test(c ?? '') ? c : '#000000');

function inkFor(hex) {
  const lum = [1, 3, 5].map((i) => parseInt(hexColour(hex).slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
  return (lum + 0.05) / 0.05 > 1.05 / (lum + 0.05) ? '#000000' : '#ffffff';
}

return { esc, raw, html, mapsUrl, safeUrl, hexColour, inkFor };
})();
__fb["plan.js"] = (() => {
// What's next, what's late and what's left to book. Pure functions over the itinerary.
const { toMinutes, fromMinutes, formatDay } = __fb["clock.js"];

const STOP_TYPES = ['transport', 'sight', 'meal', 'rest', 'logistics'];
const BOOKING_STATUSES = ['unconfirmed', 'unknown', 'todo', 'optional', 'on-the-day', 'booked'];
const GRACE_MINUTES = 15;
const STATUS_RANK = Object.fromEntries(BOOKING_STATUSES.map((s, i) => [s, i]));

const stopTickId = (stop) => `stop:${stop.id}`;
const bookingTickId = (booking) => `booking:${booking.id}`;

function stopState(day, stop, now, ticks) {
  if (ticks.has(stopTickId(stop))) return 'done';
  if (day.date < now.date) return 'past';
  if (day.date > now.date) return 'upcoming';
  return toMinutes(stop.time) + GRACE_MINUTES < now.minutes ? 'past' : 'upcoming';
}

const nextStop = (day, now, ticks) => day.stops.find((s) => stopState(day, s, now, ticks) === 'upcoming') ?? null;

function stopAfter(day, stop) {
  const i = day.stops.indexOf(stop);
  return i >= 0 ? day.stops[i + 1] ?? null : null;
}

// hours: [{ days: [0–6], from, to }]. A `to` earlier than `from` runs past midnight into the next day.
function serviceOpen(service, now) {
  if (!service?.hours?.length) return true;
  const yesterday = (now.weekday + 6) % 7;
  return service.hours.some((h) => {
    const from = toMinutes(h.from);
    const to = toMinutes(h.to);
    if (to > from) return h.days.includes(now.weekday) && now.minutes >= from && now.minutes < to;
    return (h.days.includes(now.weekday) && now.minutes >= from) || (h.days.includes(yesterday) && now.minutes < to);
  });
}

function leavingNow(option, now, targetMinutes, service) {
  const [lo, hi] = option.minutes;
  return {
    from: fromMinutes(now.minutes + lo),
    to: fromMinutes(now.minutes + hi),
    late: targetMinutes != null && now.minutes + hi > targetMinutes,
    closed: service ? !serviceOpen(service, now) : false,
  };
}

const bookingDone = (b, ticks) => b.status === 'booked' || ticks.has(bookingTickId(b));
const due = (b) => b.deadline ?? b.forDate ?? '9999-12-31';

const sortBookings = (list) =>
  [...list].sort((a, b) => due(a).localeCompare(due(b)) || (STATUS_RANK[a.status] ?? 99) - (STATUS_RANK[b.status] ?? 99));

function filterBookings(list, filter, ticks) {
  const sorted = sortBookings(list);
  if (filter === 'done') return sorted.filter((b) => bookingDone(b, ticks));
  if (filter === 'todo') return sorted.filter((b) => !bookingDone(b, ticks) && ['todo', 'unconfirmed', 'unknown'].includes(b.status));
  return sorted;
}

function boardRows(tab, date, now) {
  return tab.rows.map((row) => {
    const dep = row.times[0];
    const gone = date < now.date || (date === now.date && toMinutes(dep) < now.minutes);
    return { ...row, gone, state: dep === tab.plan ? 'plan' : gone ? 'past' : 'later' };
  });
}

const activeAlerts = (alerts = [], now) => alerts.filter((a) => a.date >= now.date);
const alertsOn = (alerts = [], date) => alerts.filter((a) => a.date === date);

const findDining = (trip, key) => (trip.dining ?? []).find((d) => `${d.date}/${d.meal}` === key) ?? null;

function findStop(trip, id) {
  for (const day of trip.days ?? []) {
    const stop = day.stops.find((s) => s.id === id);
    if (stop) return { day, stop };
  }
  return null;
}

const guideIdsOf = (stop) => (stop.guide == null ? [] : [stop.guide].flat());

function guidesInTripOrder(trip, guides = []) {
  const order = [];
  for (const day of trip.days ?? []) for (const s of day.stops ?? []) for (const id of guideIdsOf(s)) if (!order.includes(id)) order.push(id);
  const rank = (g) => (g.kind === 'city' ? -1 : order.includes(g.id) ? order.indexOf(g.id) : order.length);
  return [...guides].sort((a, b) => rank(a) - rank(b));
}

function askContext({ trip, now, ticks, viewing }) {
  const lines = [`It's ${formatDay(now.date)}, ${now.time} local time (${trip.meta.timezone}).`];
  const idx = (trip.days ?? []).findIndex((d) => d.date === now.date);
  if (idx >= 0) {
    const day = trip.days[idx];
    lines.push(`Day ${idx + 1} of ${trip.days.length}: ${day.title}, in ${day.city}.`);
    const next = nextStop(day, now, ticks);
    if (next) lines.push(`Next stop: ${next.title} at ${next.timeLabel ?? next.time}.`);
  } else if (now.date < trip.meta.startDate) {
    lines.push(`The trip starts ${formatDay(trip.meta.startDate)}.`);
  }
  if (viewing) lines.push(`I'm looking at: ${viewing}.`);
  const booked = (trip.bookings ?? []).filter((b) => ticks.has(bookingTickId(b))).map((b) => b.item);
  if (booked.length) lines.push(`Marked as booked on my phone: ${booked.join('; ')}.`);
  return lines.join('\n');
}

const ENTRY_LABEL = { required: 'PRE-BOOK', recommended: 'BOOK AHEAD', 'at-door': 'AT THE DOOR', free: 'FREE' };

function entryFor(guides, stop) {
  if (stop.entry) return stop.entry;
  for (const id of guideIdsOf(stop)) {
    const g = (guides ?? []).find((x) => x.id === id);
    if (g?.entry) return g.entry;
  }
  return null;
}

function entryState(trip, entry, ticks) {
  const booking = entry.bookingId ? (trip.bookings ?? []).find((b) => b.id === entry.bookingId) ?? null : null;
  const booked = booking ? bookingDone(booking, ticks) : false;
  return { booked, booking, kind: booked ? 'booked' : entry.booking, label: booked ? 'BOOKED ✓' : ENTRY_LABEL[entry.booking] ?? entry.booking };
}

function ticketFor(tickets, { bookingId, stopId } = {}) {
  const list = tickets ?? [];
  return (bookingId && list.find((t) => t.booking === bookingId)) || (stopId && list.find((t) => t.stop === stopId)) || null;
}

function liveUrl(transport, train, operator) {
  const pattern = transport?.liveStatus?.[operator];
  const number = /(\d{2,5})/.exec(train ?? '')?.[1];
  if (!pattern || !number) return null;
  const url = pattern.replace('{number}', number);
  return /^https?:\/\/[^\s"'<>]+$/.test(url) ? url : null;
}

return { STOP_TYPES, BOOKING_STATUSES, stopTickId, bookingTickId, stopState, nextStop, stopAfter, serviceOpen, leavingNow, bookingDone, sortBookings, filterBookings, boardRows, activeAlerts, alertsOn, findDining, findStop, guideIdsOf, guidesInTripOrder, askContext, ENTRY_LABEL, entryFor, entryState, ticketFor, liveUrl };
})();
__fb["views/parts.js"] = (() => {
// Small building blocks shared by the screens.
const { html, mapsUrl, safeUrl, hexColour, inkFor } = __fb["html.js"];
const { addDays, formatDay, formatDate } = __fb["clock.js"];

const TYPE_ICON = { transport: '➜', sight: '★', meal: '🍴', rest: '☾', logistics: '▣' };

const range = ([lo, hi]) => (lo === hi ? `${lo}` : `${lo}–${hi}`);

function short(text, max = 90) {
  if (!text) return '';
  const first = text.split(/(?<=[.!?])\s/)[0];
  return first.length <= max ? first : `${first.slice(0, max - 1).trimEnd()}…`;
}

const colourTile = (bg, label) => html`<span class="tile" style="background:${hexColour(bg)};color:${inkFor(bg)}" aria-hidden="true">${label}</span>`;

function tile(ctx, stop, done = false) {
  if (done) return html`<span class="tile done" aria-hidden="true">✓</span>`;
  if (stop.type === 'transport') {
    const leg = ctx.transport.routes[stop.route]?.options?.[0]?.legs?.find((l) => l.line);
    const line = leg && ctx.transport.lines[leg.line];
    if (line) return colourTile(line.colour, line.label);
    if (stop.board) return html`<span class="tile t-transport" aria-hidden="true">🚆</span>`;
  }
  return html`<span class="tile t-${stop.type}" aria-hidden="true">${TYPE_ICON[stop.type] ?? '•'}</span>`;
}

function lineChip(ctx, lineId) {
  const line = ctx.transport.lines[lineId];
  if (!line) return '';
  return html`<span class="chip" style="background:${hexColour(line.colour)};color:${inkFor(line.colour)}" title="${line.name ?? line.label}">${line.label}</span>`;
}

function routeChips(ctx, route) {
  return html`<div class="chips">${route.options.map((o) => (o.mode === 'taxi'
    ? html`<span class="chip taxi">Taxi ${range(o.minutes)} min${o.fareShort ? ` · ${o.fareShort}` : ''}</span>`
    : html`${(o.legs ?? []).filter((l) => l.line).map((l) => lineChip(ctx, l.line))}<span class="chip out">${o.label} ~${range(o.minutes)} min</span>`))}</div>`;
}

const kv = (k, v) => (v ? html`<div class="kv"><span class="k">${k}</span><span class="v">${v}</span></div>` : '');

function sources(checked, list = []) {
  const links = (list ?? []).map(safeUrl).filter(Boolean);
  if (!checked && !links.length) return '';
  const when = !checked ? '' : /^\d{4}-\d{2}-\d{2}$/.test(checked) ? `Checked ${formatDate(checked)}` : checked;
  return html`<p class="src">${when}${links.map((u, i) => html`${when || i ? ' · ' : ''}<a href="${u}" target="_blank" rel="noopener">${new URL(u).hostname.replace(/^www\./, '')}</a>`)}</p>`;
}

const mapButton = (query, label = 'Map', primary = false) => (query
  ? html`<a class="btn${primary ? ' p' : ''}" href="${mapsUrl(query)}" target="_blank" rel="noopener">📍 ${label}</a>`
  : '');

function alertBanner(alert, now) {
  const when = alert.date === now.date ? 'Today' : alert.date === addDays(now.date, 1) ? 'Tomorrow' : formatDay(alert.date);
  return html`<details class="alert" data-key="alert:${alert.date}:${alert.title}"><summary><b>⚠ ${when}: ${alert.title}</b></summary><p>${alert.text}</p>${sources(alert.checked, alert.sources)}</details>`;
}

function paceBox(trip) {
  const notes = [...(trip.travellers?.mobility ?? []), ...(trip.travellers?.dietary ?? [])];
  if (!notes.length && !trip.meta.pace) return '';
  return html`<div class="pace">${trip.meta.pace ? html`<p><b>Pace:</b> ${trip.meta.pace}</p>` : ''}${notes.length ? html`<ul>${notes.map((n) => html`<li>${n}</li>`)}</ul>` : ''}</div>`;
}

const backLink = (href, label) => html`<a class="back" href="${href}">‹ ${label}</a>`;

const notFound = (message) => html`<header class="top bar">${backLink('#/today', 'Today')}<h1>Not found</h1></header><div class="body"><p>${message}</p></div>`;

return { range, short, tile, lineChip, routeChips, kv, sources, mapButton, alertBanner, paceBox, backLink, notFound };
})();
__fb["views/entry.js"] = (() => {
// "Getting in": whether to pre-book, what it costs this group, and the official place to buy.
const { html, safeUrl } = __fb["html.js"];
const { entryState } = __fb["plan.js"];
const { kv, sources } = __fb["views/parts.js"];

function entryBadge(ctx, entry) {
  if (!entry) return '';
  const s = entryState(ctx.trip, entry, ctx.ticks);
  return html`<span class="badge b-${s.kind}">${s.label}</span>`;
}

function entryCard(ctx, entry, ticket) {
  const s = entryState(ctx.trip, entry, ctx.ticks);
  const buy = safeUrl(entry.buyUrl);
  return html`<section class="entry">
    <div class="row"><h3 class="sec">Getting in</h3>${entryBadge(ctx, entry)}</div>
    ${entry.summary ? html`<p class="lead">${entry.summary}</p>` : ''}
    ${kv('You pay', entry.prices)}${kv('Hours', entry.hours)}${kv('Allow', entry.allow)}${kv('Rules', entry.rules)}${kv('Dress', entry.dress)}${kv('Access', entry.access)}
    <div class="btns">${buy ? html`<a class="btn p" href="${buy}" target="_blank" rel="noopener">${s.booked ? 'Booking site ›' : 'Buy tickets ›'}</a>` : ''}${ticket ? html`<button class="btn" type="button" data-action="ticket" data-id="${ticket.id}">🎟 My ticket</button>` : ''}</div>
    ${sources(entry.checked, entry.sources)}
  </section>`;
}

return { entryBadge, entryCard };
})();
__fb["views/ask.js"] = (() => {
// "Ask Claude": builds the context for a question and hands it to the Claude app.
const { html, raw, safeUrl } = __fb["html.js"];
const { askContext } = __fb["plan.js"];
const { short } = __fb["views/parts.js"];

const DEFAULT_CHIPS = [
  "We're running late. What now?",
  'Is the transport running right now?',
  'Somewhere nearby that suits our diet?',
  'Tell the kids something fun about this place',
];

const askAvailable = (ctx) => Boolean(safeUrl(ctx.private?.config?.claudeProjectUrl));

const askButton = (ctx) => (askAvailable(ctx)
  ? html`<button class="ask" type="button" data-action="ask" data-viewing="">✳ Ask Claude</button>` : '');

const askLine = (ctx, viewing, label = viewing) => (askAvailable(ctx)
  ? html`<button class="askline" type="button" data-action="ask" data-viewing="${viewing}">✳ Ask Claude about ${short(label, 40)}</button>` : '');

function askText(ctx, question) {
  const context = askContext({ trip: ctx.trip, now: ctx.now, ticks: ctx.ticks, viewing: ctx.ui.ask?.viewing || '' });
  return question ? `${context}\n\n${question}` : context;
}

function askUrl(config, text) {
  const base = safeUrl(config?.claudeProjectUrl);
  if (!base) return null;
  if (!config.prefillParam) return base;
  const url = new URL(base);
  url.searchParams.set(config.prefillParam, text);
  return url.toString();
}

function askSheet(ctx) {
  const ask = ctx.ui.ask;
  const chips = ctx.trip.ui?.askChips ?? DEFAULT_CHIPS;
  const online = globalThis.navigator?.onLine !== false;
  return html`<div class="sheet-wrap" role="dialog" aria-modal="true" aria-labelledby="ask-title">
    <button class="dim" type="button" data-action="ask-close" aria-label="Close"></button>
    <form class="sheet" data-form="ask">
      <h2 id="ask-title">Ask Claude</h2>
      <div class="ctx"><b>Sent with your question:</b><div class="pre">${askText(ctx, '')}</div></div>
      <textarea name="q" rows="3" placeholder="Type a question…" data-input="ask-q">${ask.q ?? ''}</textarea>
      <div class="chips">${chips.map((c) => html`<button type="button" class="pill" data-action="ask-chip" data-q="${c}">${c}</button>`)}</div>
      <button class="go" type="submit" ${online ? '' : raw('disabled')}>${online ? 'Open in Claude app ›' : 'Needs signal'}</button>
      <p class="fine">Copies your question and the context above, then opens Claude. Paste and send if it isn't filled in already.</p>
      ${ask.fallback ? html`<label class="fine">Copy this by hand:<textarea readonly class="copybox">${ask.fallback}</textarea></label>` : ''}
    </form></div>`;
}

return { DEFAULT_CHIPS, askAvailable, askButton, askLine, askText, askUrl, askSheet };
})();
__fb["views/day.js"] = (() => {
// Today and any single day: alerts, the "next" card with leaving-now estimates, and the stop list.
const { html, mapsUrl } = __fb["html.js"];
const { formatDay, toMinutes, tripPhase, daysBetween } = __fb["clock.js"];
const { nextStop, stopAfter, stopState, stopTickId, leavingNow, activeAlerts, findDining, filterBookings, boardRows, entryFor } = __fb["plan.js"];
const { entryBadge } = __fb["views/entry.js"];
const { tile, routeChips, alertBanner, paceBox, short, mapButton, notFound } = __fb["views/parts.js"];
const { askButton } = __fb["views/ask.js"];

function todayView(ctx) {
  const { trip, now } = ctx;
  const phase = tripPhase(trip.meta, now);
  if (phase === 'before') return beforeTrip(ctx);
  const day = trip.days.find((d) => d.date === now.date);
  return phase === 'after' || !day ? afterTrip(ctx) : dayScreen(ctx, day);
}

function dayView(ctx) {
  const day = ctx.trip.days.find((d) => d.date === ctx.route.params.date);
  return day ? dayScreen(ctx, day) : notFound("That day isn't in the plan.");
}

function dayScreen(ctx, day) {
  const { trip, now, ticks } = ctx;
  const idx = trip.days.indexOf(day);
  const next = day.date === now.date ? nextStop(day, now, ticks) : null;
  const pace = paceBox(trip);
  return html`<header class="top"><div class="row"><div>
      <div class="date">${formatDay(day.date)} · ${day.city} · Day ${idx + 1} of ${trip.days.length}</div>
      <h1>${day.title}</h1>
  ${ctx.weather?.[day.date] ? (() => { const w = ctx.weather[day.date]; return html`<div class="wx"><span aria-hidden="true">${w.icon}</span> ${w.text} · ${w.max}° / ${w.min}°${w.rain != null ? ` · ${w.rain}% rain` : ''}${w.sunset ? ` · sunset ${w.sunset}` : ''}</div>`; })() : ''}</div>${askButton(ctx)}</div></header>
    <div class="body">
      ${activeAlerts(trip.alerts, now).map((a) => alertBanner(a, now))}
      ${pace && !ticks.has(`pace:${day.date}`) ? html`<div class="pace-once">${pace}<button class="btn small" type="button" data-action="tick" data-id="pace:${day.date}">Got it</button></div>` : ''}
      ${next ? nextCard(ctx, day, next) : ''}
      <ol class="stops">${day.stops.map((s) => stopRow(ctx, day, s, s === next))}</ol>
      ${dayNav(trip, idx)}
    </div>`;
}

function nextCard(ctx, day, stop) {
  const route = stop.route ? ctx.transport.routes[stop.route] : null;
  const board = stop.board ? ctx.transport.boards[stop.board] : null;
  const after = stopAfter(day, stop);
  return html`<section class="next">
    <div class="lbl">Next · ${stop.timeLabel ?? stop.time}${after ? ` · then ${after.title} ${after.time}` : ''}</div>
    <h2>${stop.title}</h2>
    ${route ? routeChips(ctx, route) : ''}
    ${route ? leavingBox(ctx, route, after ? toMinutes(after.time) : null) : ''}
    ${board ? nextDepartures(ctx, day, stop, board) : ''}
    ${!route && !board && stop.notes ? html`<p class="n">${short(stop.notes, 160)}</p>` : ''}
    <div class="btns"><a class="btn p" href="#/stop/${stop.id}">${route || board ? 'Options & later times' : 'Details'}</a>${mapButton(stop.maps)}</div>
  </section>`;
}

function leavingBox(ctx, route, target) {
  return html`<div class="now"><b>Leaving now (${ctx.now.time})?</b>${route.options.map((o) => {
    const r = leavingNow(o, ctx.now, target, o.service ? ctx.transport.services[o.service] : null);
    return html`<div class="r${r.late ? ' late' : ''}"><span>${o.label}</span><b>${r.closed ? 'not running now' : `arrive ${r.from}–${r.to}${r.late ? ' · late' : ''}`}</b></div>`;
  })}</div>`;
}

function nextDepartures(ctx, day, stop, board) {
  const tab = board.tabs[stop.boardTab ?? 0] ?? board.tabs[0];
  const rows = boardRows(tab, tab.date ?? board.date ?? day.date, ctx.now).filter((r) => !r.gone).slice(0, 3);
  const last = tab.stations.length - 1;
  return html`<div class="now"><b>Next departures</b>${rows.length
    ? rows.map((r) => html`<div class="r"><span>${r.times[0]} ${tab.stations[0]}</span><b>${r.times[last] ?? '–'} ${tab.stations[last]}${r.state === 'plan' ? ' · plan' : ''}</b></div>`)
    : html`<div class="r">No more listed today</div>`}</div>`;
}

function stopRow(ctx, day, stop, isNext) {
  const state = stopState(day, stop, ctx.now, ctx.ticks);
  const dining = stop.dining ? findDining(ctx.trip, stop.dining) : null;
  const done = state === 'done';
  const entry = stop.type === 'sight' ? entryFor(ctx.guides, stop) : null;
  return html`<li class="stop ${state}${isNext ? ' is-next' : ''}">
    <button class="tick" type="button" data-action="tick" data-id="${stopTickId(stop)}" aria-pressed="${done}" aria-label="${done ? 'Mark not done' : 'Mark done'}: ${stop.title}">${tile(ctx, stop, done)}</button>
    <a class="stop-main" href="#/stop/${stop.id}">
      <span class="tm${stop.timeLabel ? ' label' : ''}">${stop.timeLabel ?? stop.time}</span>
      <span class="x"><span class="h">${stop.title}${stop.optional ? html` <span class="opt">optional</span>` : ''}${entry ? html` ${entryBadge(ctx, entry)}` : ''}</span>
        ${dining?.badge ? html`<span class="chip diet">${dining.badge}</span>` : stop.notes ? html`<span class="n">${short(stop.notes)}</span>` : ''}</span>
    </a>
    ${stop.maps ? html`<a class="map" href="${mapsUrl(stop.maps)}" target="_blank" rel="noopener" aria-label="Map: ${stop.title}">📍</a>` : ''}
  </li>`;
}

function dayNav(trip, idx) {
  const prev = trip.days[idx - 1];
  const next = trip.days[idx + 1];
  return html`<nav class="daynav" aria-label="Other days">${prev ? html`<a class="btn" href="#/day/${prev.date}">‹ ${formatDay(prev.date)}</a>` : html`<span></span>`}${next ? html`<a class="btn" href="#/day/${next.date}">${formatDay(next.date)} ›</a>` : ''}</nav>`;
}

function beforeTrip(ctx) {
  const { trip, now } = ctx;
  const n = daysBetween(now.date, trip.meta.startDate);
  const first = trip.days[0];
  const todo = filterBookings(trip.bookings ?? [], 'todo', ctx.ticks).slice(0, 5);
  return html`<header class="top"><div class="row"><div><div class="date">${trip.meta.title}</div>
      <h1>Starts in ${n} day${n === 1 ? '' : 's'}</h1><div class="sub">${formatDay(trip.meta.startDate)} – ${formatDay(trip.meta.endDate)}</div></div>${askButton(ctx)}</div></header>
    <div class="body">
      ${activeAlerts(trip.alerts, now).map((a) => alertBanner(a, now))}
      ${todo.length ? html`<h3 class="sec">Still to book</h3><ul class="plain">${todo.map((b) => html`<li><a href="#/bookings">${b.item}</a> <span class="n">for ${formatDay(b.forDate)}</span></li>`)}</ul>` : ''}
      ${first ? html`<h3 class="sec">Day 1 · ${formatDay(first.date)} · ${first.title}</h3><ol class="stops">${first.stops.map((s) => stopRow(ctx, first, s, false))}</ol>` : ''}
      <div class="btns"><a class="btn" href="#/days">All days</a></div>
    </div>`;
}

const afterTrip = (ctx) => html`<header class="top"><div class="date">${ctx.trip.meta.title}</div><h1>Trip over</h1></header>
  <div class="body"><p>Welcome home. Everything from the trip is still here.</p><div class="btns"><a class="btn p" href="#/days">All days</a></div></div>`;

return { todayView, dayView, stopRow };
})();
__fb["views/days.js"] = (() => {
// All days at a glance, with alerts on top until they've passed.
const { html } = __fb["html.js"];
const { formatDay, weekdayOf } = __fb["clock.js"];
const { activeAlerts, alertsOn } = __fb["plan.js"];
const { alertBanner } = __fb["views/parts.js"];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function daysView(ctx) {
  const { trip, now } = ctx;
  const stays = (trip.stays ?? []).map((s) => `${s.city} ${s.nights} night${s.nights === 1 ? '' : 's'}`).join(', ');
  return html`<header class="top bar"><h1>All days</h1><div class="sub">${formatDay(trip.meta.startDate)} – ${formatDay(trip.meta.endDate)}${stays ? ` · ${stays}` : ''}</div></header>
    <div class="body">${activeAlerts(trip.alerts, now).map((a) => alertBanner(a, now))}
      <ul class="days">${trip.days.map((d) => {
        const state = d.date < now.date ? 'past' : d.date === now.date ? 'today' : '';
        const warn = alertsOn(trip.alerts, d.date)[0];
        return html`<li><a class="day ${state}" href="#/day/${d.date}">
          <span class="dd"><span class="w">${WEEKDAYS[weekdayOf(d.date)]}</span><span class="d">${Number(d.date.slice(8))}</span></span>
          <span class="x"><span class="h">${d.title}${state === 'today' ? ' · today' : ''}</span>
            ${warn ? html`<span class="warn">⚠ ${warn.title}</span>` : html`<span class="city">${d.city} ${d.stops.map((s) => html`<i class="mini t-${s.type}"></i>`)}</span>`}</span></a></li>`;
      })}</ul></div>`;
}

return { daysView };
})();
__fb["lines.js"] = (() => {
// Which stops a metro or tram ride passes, and which one the rider is nearest.
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

function findLineStop(line, name) {
  const n = norm(name);
  return (line?.stops ?? []).find((s) => norm(s.name) === n || (s.aliases ?? []).some((a) => norm(a) === n)) ?? null;
}

function stopsToward(line, direction) {
  const end = findLineStop(line, direction);
  if (line?.directions) {
    const key = Object.keys(line.directions).find((k) => norm(k) === norm(direction) || (end && norm(findLineStop(line, k)?.name) === norm(end.name)));
    if (key) return line.directions[key];
  }
  if (!end) return null;
  const names = line.stops.map((s) => s.name);
  return norm(end.name) === norm(names[0]) ? [...names].reverse() : names;
}

function legStops(line, leg) {
  if (!line?.stops?.length || !leg?.from || !leg.to || !leg.direction) return null;
  const order = stopsToward(line, leg.direction);
  const from = findLineStop(line, leg.from);
  const to = findLineStop(line, leg.to);
  if (!order || !from || !to) return null;
  const i = order.findIndex((n) => norm(n) === norm(from.name));
  const j = order.findIndex((n) => norm(n) === norm(to.name));
  if (i < 0 || j <= i) return null;
  return order.slice(i, j + 1).map((name, k, arr) => ({ ...findLineStop(line, name), name, role: k === 0 ? 'board' : k === arr.length - 1 ? 'alight' : 'pass' }));
}

function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function whereOnLeg(stops, pos, maxKm = 1.5) {
  let best = null;
  stops.forEach((s, index) => {
    if (typeof s.lat !== 'number' || typeof s.lng !== 'number') return;
    const km = distanceKm(pos, s);
    if (!best || km < best.km) best = { index, km };
  });
  if (!best || best.km > maxKm) return null;
  return { index: best.index, name: stops[best.index].name, km: best.km, left: stops.length - 1 - best.index };
}

return { findLineStop, stopsToward, legStops, distanceKm, whereOnLeg };
})();
__fb["views/strip.js"] = (() => {
// A metro or tram ride drawn as a strip of stops, with the rider's nearest stop when GPS is on.
const { html, hexColour } = __fb["html.js"];
const { legStops, whereOnLeg } = __fb["lines.js"];
const { lineChip } = __fb["views/parts.js"];

function lineStrip(ctx, leg, { change = false } = {}) {
  const line = ctx.transport.lines[leg.line];
  const stops = legStops(line, leg);
  if (!stops) return null;
  const here = ctx.ui.gps?.pos ? whereOnLeg(stops, ctx.ui.gps.pos) : null;
  const n = stops.length - 1;
  const last = stops[n].name;
  return html`<div class="strip" style="--c:${hexColour(line.colour)}">
    <div class="strip-head">${lineChip(ctx, leg.line)} <b>Direction ${leg.direction}</b> · ${n} stop${n === 1 ? '' : 's'}</div>
    <ol class="strip-stops">${stops.map((s, i) => html`<li class="${s.role}${here?.index === i ? ' here' : ''}"><span>${s.name}</span>${s.role === 'board' ? html`<b class="tag">BOARD</b>` : ''}${s.role === 'alight' ? html`<b class="tag">${change ? 'CHANGE' : 'GET OFF'}</b>` : ''}${here?.index === i ? html`<b class="tag here">YOU'RE HERE</b>` : ''}</li>`)}</ol>
    ${here ? html`<p class="gps-note">📍 Near ${here.name} · ${here.left} stop${here.left === 1 ? '' : 's'} to ${last}</p>` : ''}
    ${ctx.ui.gps?.pos && !here ? html`<p class="gps-note">📍 You're not near this line: no stop within 1.5 km.</p>` : ''}
    ${leg.text ? html`<p class="n">${leg.text}</p>` : ''}
  </div>`;
}

const callsAt = (stops) => html`<ol class="strip-stops calls">${stops.map((s, i) => html`<li class="${i === 0 ? 'board' : i === stops.length - 1 ? 'alight' : 'pass'}"><span>${s.time ? html`<b>${s.time}</b> ` : ''}${s.name}${s.note ? html` <em>${s.note}</em>` : ''}</span></li>`)}</ol>`;

return { lineStrip, callsAt };
})();
__fb["views/meal.js"] = (() => {
// A planned meal: the place, how it caters for the diet, that day's hours, a phrase to show staff, and backups.
const { html } = __fb["html.js"];
const { kv, sources, mapButton } = __fb["views/parts.js"];

const MEALS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };

function mealPanel(ctx, d) {
  const phrase = ctx.trip.ui?.dietPhrase;
  const backups = (ctx.trip.diningExtras ?? []).filter((x) => !d.city || x.city === d.city);
  const tags = d.tags ?? (d.badge ? [d.badge] : []);
  return html`<section class="panel meal">
    <h3 class="sec">${MEALS[d.meal] ?? d.meal}: ${d.place}</h3>
    ${tags.length ? html`<div class="chips">${tags.map((t) => html`<span class="chip diet">${t}</span>`)}</div>` : ''}
    ${kv('Address', d.address)}${kv('Setup', d.setup)}${kv('That day', d.hoursThatDay)}${kv('Closed', d.closed)}
    ${kv('Book', d.book === true ? 'Yes' : d.book === false ? 'No need' : null)}
    ${phrase ? html`<div class="say"><div>Say when ordering:</div><div class="big">${phrase.say}</div><div>${phrase.meaning}</div></div>` : ''}
    <div class="btns">${mapButton(d.maps, 'Open in Maps', true)}</div>
    ${backups.length ? html`<details class="more" data-key="backups:${d.date}:${d.meal}"><summary>Backups and treats nearby (${backups.length})</summary>${backups.map((b) => html`<div class="extra"><b>${b.place}</b> · ${b.where}<div class="n">${b.note}</div></div>`)}</details>` : ''}
    ${sources(ctx.trip.meta.factsCheckedBetween?.at(-1), [d.source])}
  </section>`;
}

return { mealPanel };
})();
__fb["views/stay.js"] = (() => {
// A place to stay. Private details (address, host, arrival steps) come from the encrypted part of the trip.
const { html, safeUrl } = __fb["html.js"];
const { formatDay } = __fb["clock.js"];
const { kv, mapButton } = __fb["views/parts.js"];

const steps = (title, list) => (Array.isArray(list) && list.length
  ? html`<h4 class="sub">${title}</h4><ol class="steps">${list.map((s) => html`<li>${s}</li>`)}</ol>`
  : '');

function stayPanel(ctx, stay) {
  const p = ctx.private?.stays?.[stay.id] ?? {};
  const address = typeof p.address === 'string' && p.address ? p.address : null;
  const listing = safeUrl(p.listingUrl);
  return html`<section class="panel stay">
    <h3 class="sec">${stay.city} · ${stay.area}</h3>
    ${kv('Dates', `${formatDay(stay.checkIn)} → ${formatDay(stay.checkOut)} · ${stay.nights} night${stay.nights === 1 ? '' : 's'}`)}
    ${kv('Check-in', stay.checkInFrom ? `from ${stay.checkInFrom}` : null)}${kv('Check-out', stay.checkOutBy ? `by ${stay.checkOutBy}` : null)}
    ${kv('How', stay.checkInMethod)}${kv('Address', address ?? p.addressNote)}${kv('Host', p.host)}${kv('Reg. code', p.registrationCode)}${kv('Sleeps', stay.sleeps)}
    ${steps('Getting in', p.arrival)}${steps('Leaving', p.departure)}
    ${stay.notes ? html`<p class="n">${stay.notes}</p>` : ''}
    ${stay.amenities?.length ? html`<ul class="plain">${stay.amenities.map((a) => html`<li>${a}</li>`)}</ul>` : ''}
    <div class="btns">${address ? html`<button class="btn p" type="button" data-action="driver" data-text="${address}">Show the driver</button>` : ''}${mapButton(address ?? stay.maps)}${listing ? html`<a class="btn" href="${listing}" target="_blank" rel="noopener">Listing</a>` : ''}</div>
  </section>`;
}

return { stayPanel };
})();
__fb["views/stop.js"] = (() => {
// One stop in detail: transport options with later times, departure boards, meal and stay cards.
const { html, safeUrl } = __fb["html.js"];
const { formatDay } = __fb["clock.js"];
const { findStop, findDining, stopTickId, boardRows, guideIdsOf, entryFor, ticketFor, liveUrl } = __fb["plan.js"];
const { lineStrip, callsAt } = __fb["views/strip.js"];
const { entryBadge, entryCard } = __fb["views/entry.js"];
const { kv, sources, mapButton, notFound, range, lineChip, backLink } = __fb["views/parts.js"];
const { askLine } = __fb["views/ask.js"];
const { mealPanel } = __fb["views/meal.js"];
const { stayPanel } = __fb["views/stay.js"];

function stopView(ctx) {
  const found = findStop(ctx.trip, ctx.route.params.id);
  if (!found) return notFound("That stop isn't in the plan any more.");
  const { day, stop } = found;
  const route = stop.route ? ctx.transport.routes[stop.route] : null;
  const board = stop.board ? ctx.transport.boards[stop.board] : null;
  const dining = stop.dining ? findDining(ctx.trip, stop.dining) : null;
  const stay = stop.stay ? (ctx.trip.stays ?? []).find((s) => s.id === stop.stay) : null;
  const guides = guideIdsOf(stop).map((id) => ctx.guides.find((g) => g.id === id)).filter(Boolean);
  const when = stop.timeLabel ?? stop.time;
  const entry = entryFor(ctx.guides, stop);
  return html`<header class="top bar t-${stop.type}">${backLink(`#/day/${day.date}`, formatDay(day.date))}
      <h1>${stop.title}</h1><div class="sub">${when}${stop.optional ? ' · optional' : ''} ${entryBadge(ctx, entry)}</div></header>
    <div class="body">
      ${stop.notes ? html`<p class="lead">${stop.notes}</p>` : ''}
      ${entry ? entryCard(ctx, entry, ticketFor(ctx.private?.tickets, { bookingId: entry.bookingId, stopId: stop.id })) : ''}
      ${route ? routePanel(ctx, stop.id, route) : ''}
      ${board ? boardPanel(ctx, board, stop.boardTab ?? 0, day.date) : ''}
      ${dining ? mealPanel(ctx, dining) : ''}
      ${stay ? stayPanel(ctx, stay) : ''}
      ${guides.map((g) => html`<a class="btn guide-link" href="#/guide/${g.id}">✦ Guide: ${g.title}</a>`)}
      <div class="btns">${dining?.maps ? '' : mapButton(stop.maps)}<button class="btn" type="button" data-action="tick" data-id="${stopTickId(stop)}">${ctx.ticks.has(stopTickId(stop)) ? 'Mark not done' : 'Mark done'}</button></div>
      ${askLine(ctx, `${stop.title} (${formatDay(day.date)}, ${when})`, stop.title)}
    </div>`;
}

function tabs(group, labels, active) {
  return html`<div class="tabs" role="tablist">${labels.map((label, j) => html`<button type="button" role="tab" class="tab${j === active ? ' on' : ''}" aria-selected="${j === active}" data-action="tab" data-group="${group}" data-tab="${j}">${label}</button>`)}</div>`;
}

function routePanel(ctx, key, route) {
  const group = `route:${key}`;
  const i = Math.min(ctx.ui.tabs[group] ?? 0, route.options.length - 1);
  const o = route.options[i];
  return html`<section class="panel">
    ${route.options.length > 1 ? tabs(group, route.options.map((x) => `${x.label} ${range(x.minutes)}′`), i) : html`<h3 class="sec">${o.label} · ${range(o.minutes)} min</h3>`}
    ${o.mode === 'taxi' ? taxiOption(ctx, o) : transitOption(ctx, o)}</section>`;
}

function transitOption(ctx, o) {
  const service = o.service ? ctx.transport.services[o.service] : null;
  const legs = o.legs ?? [];
  const strips = legs.map((l, i) => (l.line ? lineStrip(ctx, l, { change: legs.slice(i + 1).some((x) => x.line) }) : null));
  const lineIds = [...new Set(legs.filter((l) => l.line).map((l) => l.line))];
  const maps = lineIds.map((id) => ctx.transport.lines[id]).filter((l) => safeUrl(l?.mapUrl));
  const gps = ctx.ui.gps ?? {};
  return html`${strips.some(Boolean) ? html`<button class="pill gps${gps.on ? ' on' : ''}" type="button" data-action="gps" aria-pressed="${Boolean(gps.on)}">📍 Where am I? ${gps.on ? 'On' : 'Off'}</button>${gps.error ? html`<p class="n">${gps.error}</p>` : ''}${gps.on && !gps.pos ? html`<p class="gps-note">📍 Finding you… (underground this can take a while)</p>` : ''}` : ''}
    ${legs.map((l, i) => strips[i] ?? html`<ol class="legs">${legRow(ctx, l)}</ol>`)}
    ${maps.length ? html`<div class="btns">${maps.map((l) => html`<a class="btn" href="${l.mapUrl}" target="_blank" rel="noopener">🗺 ${l.name ?? l.label} map ›</a>`)}</div>` : ''}
    ${service || o.later ? html`<h3 class="sec">Going later?</h3>${kv('Runs', service?.hoursText)}${kv('Every', service?.frequency)}${kv('Leave by', o.later)}` : ''}
    ${o.fare || o.pay ? html`<h3 class="sec">Paying</h3>${kv('Fare', o.fare)}${kv('How', o.pay)}` : ''}
    ${kv('Access', o.access)}
    ${o.notes ? html`<p class="n">${o.notes}</p>` : ''}
    ${sources(o.checked ?? service?.checked ?? ctx.transport.checked, o.sources ?? service?.sources)}`;
}

function legRow(ctx, l) {
  if (l.line) {
    const stops = l.stops ? `, ${l.stops} stop${l.stops === 1 ? '' : 's'}` : '';
    return html`<li class="leg"><span class="dot">${lineChip(ctx, l.line)}</span><span><b>Direction ${l.direction}</b>${stops} to <b>${l.to}</b>${l.text ? `. ${l.text}` : ''}</span></li>`;
  }
  if (l.walk != null || l.minutes) {
    return html`<li class="leg"><span class="dot">🚶</span><span><b>Walk${l.minutes ? ` ${l.minutes} min` : ''}</b>${l.walk ? ` (${l.walk} m)` : ''}${l.text ? ` ${l.text}` : ''}</span></li>`;
  }
  return html`<li class="leg"><span class="dot">•</span><span>${l.text ?? ''}</span></li>`;
}

function taxiOption(ctx, o) {
  return html`${kv('Time', `${range(o.minutes)} min`)}${kv('Fare', o.fare)}${kv('Where', o.where)}
    ${o.notes ? html`<p class="n">${o.notes}</p>` : ''}
    ${o.driverText ? html`<div class="btns"><button class="btn p" type="button" data-action="driver" data-text="${o.driverText}">Show the driver</button></div>` : ''}
    ${sources(o.checked ?? ctx.transport.checked, o.sources)}`;
}

function boardPanel(ctx, board, defaultTab, fallbackDate) {
  const group = `board:${board.id}`;
  const i = Math.min(ctx.ui.tabs[group] ?? defaultTab, board.tabs.length - 1);
  const tab = board.tabs[i];
  const rows = boardRows(tab, tab.date ?? board.date ?? fallbackDate, ctx.now);
  const planned = rows.find((r) => r.state === 'plan');
  const live = (r) => liveUrl(ctx.transport, r.train, r.operator);
  const head = planned ? html`<div class="btns">${live(planned) ? html`<a class="btn p" href="${live(planned)}" target="_blank" rel="noopener">Live status ›</a>` : ''}${safeUrl(board.buyUrl) ? html`<a class="btn" href="${board.buyUrl}" target="_blank" rel="noopener">Buy ticket ›</a>` : ''}</div>
    ${planned.stops?.length ? html`<h3 class="sec">Calls at · ${planned.train ?? ''}</h3>${callsAt(planned.stops)}` : ''}` : '';
  const trainLabel = (r) => (r.train && !String(r.note ?? '').includes(r.train.replace(/^\D+/, '')) ? r.train : '');
  return html`<section class="panel">
    ${board.title ? html`<h3 class="sec">${board.title}</h3>` : ''}
    ${board.tabs.length > 1 ? tabs(group, board.tabs.map((t) => t.label), i) : ''}
    ${tab.note ? html`<p class="n">${tab.note}</p>` : ''}
    ${head}
    <div class="scroll-x"><table class="board"><thead><tr><th></th>${tab.stations.map((s) => html`<th scope="col">${s}</th>`)}</tr></thead>
      <tbody>${rows.map((r) => html`<tr class="${r.state}${r.gone ? ' gone' : ''}"><td>${r.state === 'plan' ? html`<span class="tag">PLAN</span>` : r.flag ? html`<span class="tag flag">${r.flag}</span>` : ''}</td>${r.times.map((t) => html`<td class="t">${t ?? '–'}</td>`)}</tr>${r.note || live(r) || trainLabel(r) ? html`<tr class="rnote"><td></td><td colspan="${r.times.length}">${r.flag && r.state === 'plan' ? `${r.flag}: ` : ''}${[trainLabel(r), r.note].filter(Boolean).join(' · ')}${live(r) ? html`${r.note || trainLabel(r) ? ' · ' : ''}<a href="${live(r)}" target="_blank" rel="noopener">Live ›</a>` : ''}</td></tr>` : ''}`)}</tbody></table></div>
    ${board.notes ? html`<p class="n">${board.notes}</p>` : ''}
    ${sources(board.checked, board.sources)}</section>`;
}

return { stopView, routePanel, boardPanel };
})();
__fb["views/bookings.js"] = (() => {
// Everything to book, soonest first. Ticks on the phone count as booked.
const { html, raw, safeUrl } = __fb["html.js"];
const { formatDay } = __fb["clock.js"];
const { filterBookings, bookingDone, bookingTickId } = __fb["plan.js"];

const LABEL = { todo: 'TO DO', unconfirmed: 'UNCONFIRMED', unknown: 'UNKNOWN', booked: 'BOOKED', optional: 'OPTIONAL', 'on-the-day': 'ON THE DAY' };
const FILTERS = [['todo', 'To do'], ['all', 'All'], ['done', 'Done']];

function bookingsView(ctx) {
  const all = ctx.trip.bookings ?? [];
  const filter = ctx.ui.bookingFilter ?? 'todo';
  const list = filterBookings(all, filter, ctx.ticks);
  const left = filterBookings(all, 'todo', ctx.ticks).length;
  const today = ctx.now.date;
  const tickets = [...(ctx.private?.tickets ?? [])].sort((a, b) => (b.date === today) - (a.date === today) || a.date.localeCompare(b.date));
  const wallet = tickets.length ? html`<h3 class="sec">Your tickets</h3><ul class="wallet">${tickets.map((t) => html`<li><button type="button" class="ticket" data-action="ticket" data-id="${t.id}"><span class="ic">${t.mime === 'application/pdf' ? 'PDF' : 'IMG'}</span><span class="x"><span class="h">${t.label}</span><span class="n">${formatDay(t.date)}${t.date === today ? ' · today' : t.date < today ? ' · used' : ''}${t.notes ? ` · ${t.notes}` : ''}</span></span><b>Show ›</b></button></li>`)}</ul>` : '';
  return html`<header class="top bar"><h1>Tickets</h1><div class="sub">Soonest first · ${left} left to do</div></header>
    <div class="body">
      ${wallet}
      <h3 class="sec">To book</h3>
      <div class="filters">${FILTERS.map(([id, label]) => html`<button type="button" class="pill${id === filter ? ' on' : ''}" aria-pressed="${id === filter}" data-action="filter" data-filter="${id}">${label}</button>`)}</div>
      ${list.length ? html`<ul class="bookings">${list.map((b) => bookingRow(ctx, b))}</ul>` : html`<p class="empty">Nothing here.</p>`}
    </div>`;
}

function bookingRow(ctx, b) {
  const ticked = ctx.ticks.has(bookingTickId(b));
  const done = bookingDone(b, ctx.ticks);
  const url = safeUrl(b.url);
  return html`<li class="bk${done ? ' done' : ''}">
    <button type="button" class="box${done ? ' on' : ''}${b.status === 'optional' ? ' dashed' : ''}" data-action="tick" data-id="${bookingTickId(b)}" aria-pressed="${ticked}" aria-label="${ticked ? 'Untick' : 'Tick'}: ${b.item}" ${b.status === 'booked' ? raw('disabled') : ''}>${done ? '✓' : ''}</button>
    <details data-key="booking:${b.id}"><summary><span class="h">${b.item}</span>
      <span class="meta"><span class="st st-${ticked ? 'ticked' : b.status}">${ticked ? 'TICKED' : LABEL[b.status] ?? b.status}</span> for ${formatDay(b.forDate)}${b.deadline ? ` · by ${formatDay(b.deadline)}` : ''}</span></summary>
      ${b.notes ? html`<p class="n">${b.notes}</p>` : ''}
      ${url ? html`<a class="btn" href="${url}" target="_blank" rel="noopener">Open the booking site</a>` : ''}
    </details>
    ${url && !done ? html`<a class="btn small" href="${url}" target="_blank" rel="noopener">Buy ›</a>` : ''}
  </li>`;
}

return { bookingsView };
})();
__fb["views/guide.js"] = (() => {
// The pocket guide: city intros, then each place in trip order.
const { html, safeUrl } = __fb["html.js"];
const { guidesInTripOrder, ticketFor } = __fb["plan.js"];
const { entryBadge, entryCard } = __fb["views/entry.js"];
const { sources, notFound, backLink } = __fb["views/parts.js"];
const { askLine } = __fb["views/ask.js"];

const guideList = (ctx, guides) => html`<ul class="glist">${guides.map((g) => html`<li><a href="#/guide/${g.id}"><span class="h">${g.title}${g.entry ? html` ${entryBadge(ctx, g.entry)}` : ''}</span><span class="n">${g.city ?? ''}</span></a></li>`)}</ul>`;

function guideListView(ctx) {
  const ordered = guidesInTripOrder(ctx.trip, ctx.guides);
  const cities = ordered.filter((g) => g.kind === 'city');
  const places = ordered.filter((g) => g.kind !== 'city');
  return html`<header class="top bar"><h1>Guide</h1><div class="sub">${places.length} place${places.length === 1 ? '' : 's'} · about 3 minutes each, read aloud</div></header>
    <div class="body">
      ${cities.length ? html`<h3 class="sec">Cities</h3>${guideList(ctx, cities)}` : ''}
      ${places.length ? html`<h3 class="sec">Places, in trip order</h3>${guideList(ctx, places)}` : html`<p class="empty">No guides in this trip.</p>`}
    </div>`;
}

function guideView(ctx) {
  const g = ctx.guides.find((x) => x.id === ctx.route.params.id);
  if (!g) return notFound("That guide isn't in this trip.");
  const bullets = (items) => html`<ul class="dots">${items.map((x) => html`<li>${x}</li>`)}</ul>`;
  const hero = g.images?.hero;
  const thumb = (i) => g.images?.lookFor?.find((x) => x.index === i);
  const credit = (img) => html`<a class="credit" href="${safeUrl(img.page) ?? '#'}" target="_blank" rel="noopener">Photo: ${img.credit} · ${img.licence}</a>`;
  const canSpeak = Boolean(globalThis.speechSynthesis);
  return html`<header class="hero${hero ? ' has-photo' : ''}">${backLink('#/guide', 'Guide')}
      ${hero && safeUrl(hero.src) ? html`<img class="hero-img" src="${hero.src}" alt="${hero.alt}" loading="lazy" crossorigin="anonymous">` : ''}
      <h1>${g.title}</h1><p>${g.why}</p></header>
    ${hero ? credit(hero) : ''}
    <div class="body">
      ${canSpeak ? html`<button class="listen" type="button" data-action="listen" data-id="${g.id}">${ctx.ui.speaking === g.id ? (ctx.ui.paused ? '▶ Resume' : '❚❚ Pause') : '▶ Listen'}<span>${ctx.ui.speaking === g.id ? 'tap to pause or resume' : "uses your phone's voice"}</span></button>` : ''}
      ${g.entry ? entryCard(ctx, g.entry, ticketFor(ctx.private?.tickets, { bookingId: g.entry.bookingId })) : ''}
      ${g.lookFor?.length ? html`<h3 class="sec">Look for</h3><ul class="look">${g.lookFor.map((x, i) => { const t = thumb(i); return html`<li>${t && safeUrl(t.src) ? html`<img src="${t.src}" alt="${t.alt}" loading="lazy" crossorigin="anonymous" title="${t.credit} · ${t.licence}">` : ''}<span>${x}</span></li>`; })}</ul>` : ''}
      ${g.facts?.length ? html`<h3 class="sec">Facts</h3>${bullets(g.facts)}` : ''}
      ${g.kids?.length ? html`<h3 class="sec">For the kids</h3>${g.kids.map((k, i) => html`<details class="kid" data-key="kid:${g.id}:${i}"><summary>${k.q}</summary><p class="ans">${k.a}</p></details>`)}` : ''}
      ${g.links?.length || g.video ? html`<h3 class="sec">Read more</h3><ul class="readmore">${(g.links ?? []).map((l) => (safeUrl(l.url) ? html`<li><a href="${l.url}" target="_blank" rel="noopener">${l.label}<b>›</b></a></li>` : ''))}${g.video && safeUrl(g.video.url) ? html`<li><a href="${g.video.url}" target="_blank" rel="noopener">▶ ${g.video.label}${g.video.minutes ? ` · ${g.video.minutes} min` : ''}<b>›</b></a></li>` : ''}</ul>` : ''}
      ${askLine(ctx, g.title)}
      ${sources(g.checked, g.sources)}
    </div>`;
}

return { guideListView, guideView };
})();
__fb["views/info.js"] = (() => {
// Quick-reference cards. Each card lists sections of the itinerary to show (see docs/itinerary-format.md).
const { html, safeUrl, hexColour, inkFor } = __fb["html.js"];
const { formatDay, formatDate } = __fb["clock.js"];
const { kv, sources, paceBox, notFound, backLink } = __fb["views/parts.js"];
const { askButton } = __fb["views/ask.js"];
const { boardPanel } = __fb["views/stop.js"];
const { mealPanel } = __fb["views/meal.js"];
const { stayPanel } = __fb["views/stay.js"];

function infoCards(trip) {
  if (trip.ui?.infoCards?.length) return trip.ui.infoCards;
  const cards = (trip.localTransport ?? []).map((t, i) => ({ id: `transport-${i}`, title: `${t.city} transport`, icon: '➜', colour: '#00843d', sections: [`localTransport:${t.city}`] }));
  if (trip.transfers?.length) cards.push({ id: 'transfers', title: 'Transfers', icon: '🚕', colour: '#ffd400', sections: ['transfers'] });
  if (trip.dining?.length) cards.push({ id: 'food', title: 'Food', icon: '🍴', colour: '#15803d', sections: ['dining', 'diningExtras'] });
  cards.push({ id: 'boards', title: 'Trains', icon: '🚆', colour: '#334155', sections: ['boards'] });
  if (trip.tips?.length) cards.push({ id: 'tips', title: 'Tips', icon: '★', colour: '#c2410c', sections: ['tips'] });
  if (trip.stays?.length) cards.push({ id: 'stays', title: 'Stays', icon: '🏠', colour: '#4338ca', sections: ['stays'] });
  if (trip.flights) cards.push({ id: 'flights', title: 'Flights', icon: '✈', colour: '#0f172a', sections: ['flights'] });
  if (trip.links?.length) cards.push({ id: 'links', title: 'Links', icon: '🔗', colour: '#000000', sections: ['links'] });
  return cards;
}

function infoView(ctx) {
  const { trip } = ctx;
  const [from, to] = trip.meta.factsCheckedBetween ?? [];
  const checked = from && /^\d{4}/.test(from) ? (from === to || !to ? formatDate(from) : `${formatDay(from)} – ${formatDate(to)}`) : null;
  return html`<header class="top bar"><div class="row"><div><h1>Info</h1>${checked ? html`<div class="sub">Quick cards · checked ${checked}</div>` : ''}</div>${askButton(ctx)}</div></header>
    <div class="body">
      <div class="igrid">${infoCards(trip).map((c) => html`<a class="icard" href="#/info/${c.id}"><span class="tile" style="background:${hexColour(c.colour)};color:${inkFor(c.colour)}" aria-hidden="true">${c.icon ?? '•'}</span><span class="h">${c.title}</span>${c.subtitle ? html`<span class="s">${c.subtitle}</span>` : ''}</a>`)}</div>
      ${paceBox(trip)}
      <div class="btns"><button class="btn" type="button" data-action="${ctx.mode === 'demo' ? 'leave-demo' : 'lock'}">${ctx.mode === 'demo' ? 'Leave the demo' : 'Lock this phone'}</button></div>
    </div>`;
}

function infoCardView(ctx) {
  const card = infoCards(ctx.trip).find((c) => c.id === ctx.route.params.id);
  if (!card) return notFound("That card isn't in this trip.");
  return html`<header class="top bar">${backLink('#/info', 'Info')}<h1>${card.title}</h1>${card.subtitle ? html`<div class="sub">${card.subtitle}</div>` : ''}</header>
    <div class="body">${(card.sections ?? []).map((s) => section(ctx, s))}</div>`;
}

function section(ctx, spec) {
  const at = spec.indexOf(':');
  const name = at < 0 ? spec : spec.slice(0, at);
  const arg = at < 0 ? null : spec.slice(at + 1);
  const t = ctx.trip;
  switch (name) {
    case 'transfer': return transfer((t.transfers ?? []).find((x) => x.id === arg));
    case 'transfers': return html`${(t.transfers ?? []).map(transfer)}`;
    case 'localTransport': return localTransport(ctx, (t.localTransport ?? []).find((x) => x.city === arg));
    case 'dining': return html`${(t.dining ?? []).map((d) => html`<details class="more" data-key="dining:${d.date}:${d.meal}"><summary><b>${formatDay(d.date)} · ${d.meal}</b> · ${d.place}</summary>${mealPanel(ctx, d)}</details>`)}`;
    case 'diningExtras': return extras(t.diningExtras ?? []);
    case 'boards': return html`${Object.values(ctx.transport.boards).map((b) => boardPanel(ctx, b, 0, b.date ?? t.meta.startDate))}`;
    case 'tips': return html`${(t.tips ?? []).map((x) => html`<details class="more" data-key="tip:${x.topic}"><summary><b>${x.topic}</b></summary><p>${x.text}</p>${sources(null, [x.source])}</details>`)}`;
    case 'stays': return html`${(t.stays ?? []).map((s) => stayPanel(ctx, s))}`;
    case 'flights': return flights(t.flights);
    case 'links': return html`<ul class="links">${(t.links ?? []).map((l) => (safeUrl(l.url) ? html`<li><a class="btn" href="${l.url}" target="_blank" rel="noopener">${l.label}</a></li>` : ''))}</ul>`;
    case 'travellers': return paceBox(t);
    default: return '';
  }
}

function transfer(x) {
  if (!x) return '';
  return html`<section class="panel"><h3 class="sec">${x.title}</h3>${x.summary ? html`<p>${x.summary}</p>` : ''}
    ${(x.options ?? []).map((o) => html`<div class="opt-card${o.mode === x.recommended ? ' rec' : ''}"><div class="h">${o.mode}${o.mode === x.recommended ? ' · recommended' : ''}</div>${o.summary ? html`<p class="n">${o.summary}</p>` : ''}${kv('Cost', o.cost)}${o.notes ? html`<p class="n">${o.notes}</p>` : ''}</div>`)}
    ${x.ticketNotes ? html`<p class="n">${x.ticketNotes}</p>` : ''}</section>`;
}

function localTransport(ctx, lt) {
  if (!lt) return '';
  const st = lt.stops ?? {};
  return html`<section class="panel"><p class="lead">${lt.summary}</p>
    ${kv('Into town', st.intoTown)}${kv('Back', st.backFromTown)}${kv('Station', st.station)}${st.note ? html`<p class="n">${st.note}</p>` : ''}
    ${lt.routes?.length ? html`<h3 class="sec">Routes</h3>${lt.routes.map((r) => html`<div class="opt-card"><div class="h">${r.to}</div><p class="n">${r.how}</p>${kv('Time', r.minutes)}</div>`)}` : ''}
    ${kv('Every', lt.frequency)}${kv('Hours', lt.hours)}${kv('Fare', lt.fare)}${kv('How to pay', lt.howToPay)}${kv('Access', lt.accessibility)}${kv('Taxi', lt.taxiFallback)}
    ${lt.notes?.length ? html`<ul class="plain">${lt.notes.map((n) => html`<li>${n}</li>`)}</ul>` : ''}
    ${sources(ctx.trip.meta.factsCheckedBetween?.at(-1), lt.sources)}</section>`;
}

function extras(list) {
  const kinds = [...new Set(list.map((x) => x.kind))];
  return html`${kinds.map((k) => html`<h3 class="sec">${k}</h3>${list.filter((x) => x.kind === k).map((x) => html`<div class="extra"><b>${x.place}</b>${x.city ? ` · ${x.city}` : ''}<div class="n">${x.where}</div><div class="n">${x.note}</div></div>`)}`)}`;
}

function flights(f) {
  if (!f) return '';
  return html`<section class="panel">${(f.segments ?? []).map((s) => html`<div class="opt-card"><div class="h">${s.flight} · ${formatDay(s.date)}</div><p class="n">${s.fromName} ${s.depart} → ${s.toName} ${s.arrive}${s.arriveDate && s.arriveDate !== s.date ? ` (${formatDay(s.arriveDate)})` : ''}</p></div>`)}
    ${kv('Status', f.status)}${kv('Baggage', f.baggage)}${kv('Price seen', f.priceSeen)}</section>`;
}

return { infoCards, infoView, infoCardView };
})();
__fb["views/shell.js"] = (() => {
// Picks the screen for the current route and draws the bottom navigation.
const { html, raw } = __fb["html.js"];
const { todayView, dayView } = __fb["views/day.js"];
const { daysView } = __fb["views/days.js"];
const { stopView } = __fb["views/stop.js"];
const { bookingsView } = __fb["views/bookings.js"];
const { guideListView, guideView } = __fb["views/guide.js"];
const { infoView, infoCardView } = __fb["views/info.js"];
const { askSheet } = __fb["views/ask.js"];

const VIEWS = { today: todayView, day: dayView, days: daysView, stop: stopView, bookings: bookingsView, guide: guideListView, guideItem: guideView, info: infoView, infoCard: infoCardView };
const TABS = [['today', 'Today', '●'], ['days', 'Days', '▤'], ['bookings', 'Tickets', '🎟'], ['guide', 'Guide', '✦'], ['info', 'Info', 'ⓘ']];
const TAB_OF = { day: 'days', stop: 'days', guideItem: 'guide', infoCard: 'info' };

const driverOverlay = (text) => html`<div class="driver" role="dialog" aria-modal="true" aria-label="Address for the driver"><p class="big">${text}</p><button class="btn p big" type="button" data-action="driver-close">Close</button></div>`;

function renderApp(ctx) {
  const view = VIEWS[ctx.route.name] ?? todayView;
  const active = TAB_OF[ctx.route.name] ?? ctx.route.name;
  return {
    main: html`${ctx.mode === 'demo' ? html`<div class="ribbon">Sample trip · <button type="button" class="link" data-action="leave-demo">Leave the demo</button></div>` : ''}${view(ctx)}${ctx.ui.ask ? askSheet(ctx) : ''}${ctx.ui.driver ? driverOverlay(ctx.ui.driver) : ''}`,
    nav: html`${TABS.map(([id, label, icon]) => html`<a href="#/${id}" class="${id === active ? 'on' : ''}"${id === active ? raw(' aria-current="page"') : ''}><b aria-hidden="true">${icon}</b>${label}</a>`)}`,
  };
}

return { driverOverlay, renderApp };
})();
__fb["views/landing.js"] = (() => {
// What a visitor sees first: what Fieldbook is, the demo, and a way in for a trip link.
const { html } = __fb["html.js"];

const landingView = () => html`<section class="landing">
  <h1>Fieldbook</h1>
  <p class="lead">An offline trip companion. Fieldbook turns an itinerary file into a phone app: what's next, how to get there, where to eat and a pocket guide to each place, all working without signal.</p>
  <a class="btn p big" href="#demo">Try the demo</a>
  <form class="open" data-form="open-trip">
    <label for="link">Have a trip link? Paste it here</label>
    <input id="link" name="link" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="https://…#open=…">
    <button class="btn" type="submit">Open the trip</button>
  </form>
  <p class="fine">Trips are encrypted on the owner's own computer before they're uploaded, so this site only ever holds scrambled data. <a href="https://github.com/arash009/fieldbook">Source on GitHub</a>.</p>
</section>`;

const messageView = (title, text) => html`<section class="landing"><h1>${title}</h1><p class="lead">${text}</p><a class="btn" href="./">Back to the start</a></section>`;

return { landingView, messageView };
})();
__fb["views/unlock.js"] = (() => {
// The passphrase screen for an encrypted trip.
const { html, raw } = __fb["html.js"];

const unlockView = ({ error, busy } = {}) => html`<section class="unlock">
  <h1>Fieldbook</h1>
  <form data-form="unlock">
    <label for="pass">Passphrase</label>
    <input id="pass" name="pass" type="password" autocomplete="current-password" autocapitalize="none" spellcheck="false" required ${busy ? raw('disabled') : ''}>
    ${error ? html`<p class="err" role="alert">${error}</p>` : ''}
    <button class="btn p big" type="submit" ${busy ? raw('disabled') : ''}>${busy ? 'Unlocking…' : 'Unlock'}</button>
  </form>
</section>`;

return { unlockView };
})();
__fb["speech.js"] = (() => {
// Turns a guide into short sentences for the phone's speech synthesis (long utterances get cut off in Chrome).
const MAX = 220;

function split(text) {
  const out = [];
  for (const sentence of String(text ?? '').match(/[^.!?]+[.!?]*\s*/g) ?? []) {
    let s = sentence.trim();
    while (s.length > MAX) {
      const cut = s.lastIndexOf(' ', MAX);
      out.push(s.slice(0, cut > 0 ? cut : MAX));
      s = s.slice(cut > 0 ? cut + 1 : MAX);
    }
    if (s) out.push(s);
  }
  return out;
}

function speechChunks(g) {
  const parts = [`${g.title}.`, ...split(g.why)];
  if (g.lookFor?.length) parts.push('Look for these.', ...g.lookFor.flatMap(split));
  if (g.facts?.length) parts.push('Some facts.', ...g.facts.flatMap(split));
  for (const k of g.kids ?? []) parts.push('A question for the kids.', ...split(k.q), 'The answer.', ...split(k.a));
  return parts;
}

return { speechChunks };
})();
__fb["main.js"] = (() => {
// Boots the app: landing page, demo, a remembered encrypted trip, or a single-file backup.
const { localNow, parseNowOverride, daysBetween, addDays } = __fb["clock.js"];
const { forecastUrl, parseForecast } = __fb["weather.js"];
const { open, openWithKey, openBytes } = __fb["crypto.js"];
const { openTicketViewer } = __fb["ticket-viewer.js"];
const { loadKey, saveKey, forgetKey } = __fb["keystore.js"];
const { loadTicks, saveTicks, toggleTick } = __fb["ticks.js"];
const { indexPayload, rebaseDates } = __fb["data.js"];
const { parseRoute, parseSpecialHash } = __fb["router.js"];
const { renderApp } = __fb["views/shell.js"];
const { landingView, messageView } = __fb["views/landing.js"];
const { unlockView } = __fb["views/unlock.js"];
const { askText, askUrl } = __fb["views/ask.js"];
const { speechChunks } = __fb["speech.js"];

const REMEMBER = 'fieldbook:trip';
const DEMO = 'fieldbook:demo';
const main = document.getElementById('app');
const nav = document.getElementById('nav');
const toastEl = document.getElementById('toast');
const S = { mode: null, tripId: null, envelope: null, data: null, ticks: new Set(), ui: { tabs: {} } };

const wrap = (area) => ({
  get: (k) => { try { return area().getItem(k); } catch { return null; } },
  set: (k, v) => { try { area().setItem(k, v); } catch { /* storage blocked */ } },
  del: (k) => { try { area().removeItem(k); } catch { /* storage blocked */ } },
});
const local = wrap(() => localStorage);
const session = wrap(() => sessionStorage);

function now() {
  return parseNowOverride(new URLSearchParams(location.search).get('now')) ?? localNow(S.data.trip.meta.timezone);
}

const context = () => ({ ...S.data, mode: S.mode, now: now(), ticks: S.ticks, ui: S.ui, weather: S.weather, route: parseRoute(location.hash) });

function show(content) {
  main.innerHTML = String(content);
  nav.hidden = true;
}

function render() {
  if (!S.data) return;
  const openKeys = [...main.querySelectorAll('details[open][data-key]')].map((d) => d.dataset.key);
  const out = renderApp(context());
  main.innerHTML = String(out.main);
  nav.innerHTML = String(out.nav);
  nav.hidden = false;
  for (const key of openKeys) main.querySelector(`details[data-key="${CSS.escape(key)}"]`)?.setAttribute('open', '');
}

function toast(text) {
  toastEl.textContent = text;
  toastEl.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { toastEl.hidden = true; }, 3500);
}

function ready(payload) {
  S.data = indexPayload(payload);
  S.ticks = loadTicks(S.tripId);
  if (S.envelope) {
    const key = `fieldbook:iv:${S.tripId}`;
    const previous = local.get(key);
    if (previous && previous !== S.envelope.iv) toast('Trip updated');
    local.set(key, S.envelope.iv);
  }
  render();
  loadWeather();
}

async function loadWeather() {
  const trip = S.data.trip;
  const cities = trip.cities ?? {};
  const today = now().date;
  const S16 = addDays(today, 15);
  S.weather = S.weather ?? {};
  for (const [name, city] of Object.entries(cities)) {
    const dates = trip.days.filter((d) => d.city === name && d.date >= today && d.date <= S16).map((d) => d.date);
    if (!dates.length) continue;
    try {
      const res = await fetch(forecastUrl(city, trip.meta.timezone, dates[0], dates.at(-1)));
      if (res.ok) Object.assign(S.weather, parseForecast(await res.json()));
    } catch { /* no forecast: header shows none */ }
  }
  render();
}

async function unlockFlow(envelope) {
  S.envelope = envelope;
  const stored = await loadKey(S.tripId);
  if (stored && stored.salt === envelope.salt) {
    try { const data = await openWithKey(envelope, stored.key); S.key = stored.key; ready(data); return; } catch { /* the passphrase changed: ask again */ }
  }
  show(unlockView());
  main.querySelector('input')?.focus();
}

async function submitUnlock(form) {
  const pass = form.pass.value;
  show(unlockView({ busy: true }));
  try {
    const { key, data } = await open(S.envelope, pass);
    await saveKey(S.tripId, key, S.envelope.salt);
    S.key = key;
    ready(data);
  } catch {
    show(unlockView({ error: "That passphrase didn't work." }));
    main.querySelector('input')?.focus();
  }
}

async function startTrip(id) {
  S.mode = 'trip';
  S.tripId = id;
  let envelope;
  try {
    const res = await fetch(`trips/${id}.enc`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(String(res.status));
    envelope = await res.json();
  } catch {
    show(messageView('Trip not available', 'Open Fieldbook once with signal to download this trip. If you have, check the trip link.'));
    return;
  }
  await unlockFlow(envelope);
}

async function startDemo() {
  S.mode = 'demo';
  S.tripId = 'demo';
  try {
    const payload = await (await fetch('demo/trip.json')).json();
    const offset = daysBetween(payload.trip.meta.startDate, localNow(payload.trip.meta.timezone).date);
    ready(rebaseDates(payload, offset));
  } catch {
    show(messageView('Demo unavailable', 'The sample trip could not be loaded. Try again with signal.'));
  }
}

async function boot() {
  const inline = document.getElementById('fb-envelope');
  if (inline) {
    S.mode = 'file';
    S.tripId = 'file';
    await unlockFlow(JSON.parse(inline.textContent));
    return;
  }
  const secure = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
  if ('serviceWorker' in navigator && secure) navigator.serviceWorker.register('sw.js').catch(() => {});
  const special = parseSpecialHash(location.hash);
  if (special) {
    if (special.open) { local.set(REMEMBER, special.open); session.del(DEMO); }
    if (special.demo) session.set(DEMO, '1');
    history.replaceState(null, '', `${location.pathname}${location.search}#/today`);
  }
  if (session.get(DEMO)) { await startDemo(); return; }
  const id = local.get(REMEMBER);
  if (id) { await startTrip(id); return; }
  show(landingView());
}

function sendAsk(question) {
  const text = askText(context(), question);
  const url = askUrl(S.data.private.config, text);
  const copying = navigator.clipboard?.writeText(text);
  if (url) window.open(url, '_blank', 'noopener');
  Promise.resolve(copying)
    .then(() => { if (!copying) throw new Error('no clipboard'); toast("Copied. Paste it into Claude if it isn't filled in."); })
    .catch(() => { S.ui.ask.fallback = text; render(); });
}

function openTripLink(value) {
  const m = /#open=([a-z0-9]{4,32})/i.exec(value ?? '');
  if (!m) { toast("That doesn't look like a trip link."); return; }
  local.set(REMEMBER, m[1].toLowerCase());
  session.del(DEMO);
  history.replaceState(null, '', `${location.pathname}${location.search}#/today`);
  startTrip(m[1].toLowerCase());
}

async function lock() {
  await forgetKey(S.tripId);
  local.del(REMEMBER);
  local.del(`fieldbook:iv:${S.tripId}`);
  location.hash = '';
  location.reload();
}

const ACTIONS = {
  tick: (el) => { S.ticks = toggleTick(S.ticks, el.dataset.id); saveTicks(S.tripId, S.ticks); render(); },
  tab: (el) => { S.ui.tabs[el.dataset.group] = Number(el.dataset.tab); render(); },
  filter: (el) => { S.ui.bookingFilter = el.dataset.filter; render(); },
  driver: (el) => { S.ui.driver = el.dataset.text; render(); },
  'driver-close': () => { S.ui.driver = null; render(); },
  ask: (el) => { S.ui.ask = { viewing: el.dataset.viewing || '', q: '' }; render(); main.querySelector('.sheet textarea')?.focus(); },
  'ask-close': () => { S.ui.ask = null; render(); },
  'ask-chip': (el) => { S.ui.ask.q = el.dataset.q; render(); },
  lock: () => { lock(); },
  'leave-demo': () => { session.del(DEMO); location.hash = ''; location.reload(); },
};

function stopSpeech() { if (globalThis.speechSynthesis) speechSynthesis.cancel(); S.ui.speaking = null; S.ui.paused = false; }
ACTIONS.listen = (el) => {
  const synth = globalThis.speechSynthesis;
  if (!synth) return;
  if (S.ui.speaking === el.dataset.id) {
    if (synth.paused) synth.resume(); else synth.pause();
    S.ui.paused = synth.paused; render(); return;
  }
  stopSpeech();
  const g = S.data.guides.find((x) => x.id === el.dataset.id);
  const voice = synth.getVoices().find((v) => v.lang === 'en-GB') ?? synth.getVoices().find((v) => v.lang.startsWith('en'));
  const chunks = speechChunks(g);
  chunks.forEach((text, i) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-GB'; if (voice) u.voice = voice; u.rate = 0.95;
    if (i === chunks.length - 1) u.onend = () => { S.ui.speaking = null; render(); };
    synth.speak(u);
  });
  S.ui.speaking = g.id; S.ui.paused = false; render();
};

let watchId = null;
let lastPos = null;
function gpsOff(error) {
  if (watchId != null) navigator.geolocation.clearWatch(watchId);
  watchId = null; lastPos = null;
  S.ui.gps = error ? { on: false, error } : { on: false };
  render();
}
ACTIONS.gps = () => {
  if (S.ui.gps?.on) { gpsOff(); return; }
  if (!navigator.geolocation) { gpsOff('This phone has no location service.'); return; }
  S.ui.gps = { on: true };
  render();
  watchId = navigator.geolocation.watchPosition((p) => {
    const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
    const moved = !lastPos || Math.abs(pos.lat - lastPos.lat) + Math.abs(pos.lng - lastPos.lng) > 0.0003;
    if (!moved) return;
    lastPos = pos;
    S.ui.gps = { on: true, pos };
    render();
  }, (e) => {
    // Only a refusal stops the watch. No fix yet (underground, a timeout) keeps watching: the strip shows
    // "Finding you…", or the last position if there was one.
    if (e.code === 1) gpsOff('Location is blocked for this site. Allow it in Chrome settings to use Where am I?');
  }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });
};

async function fetchTicket(t) {
  const res = await fetch(t.plain ? t.file : `trips/${t.file}`, { cache: 'no-cache' });
  if (!res.ok) throw Object.assign(new Error(String(res.status)), { status: res.status });
  return t.plain ? new Uint8Array(await res.arrayBuffer()) : openBytes(await res.json(), S.key);
}

// The trip was redeployed since this page loaded and the ticket moved: reload the trip with the saved key.
async function refreshTrip() {
  try {
    const res = await fetch(`trips/${S.tripId}.enc`, { cache: 'no-cache' });
    if (!res.ok) return false;
    const envelope = await res.json();
    const data = await openWithKey(envelope, S.key);
    S.envelope = envelope;
    S.data = indexPayload(data);
    render();
    return true;
  } catch { return false; }
}

ACTIONS.ticket = (el) => {
  const t = (S.data.private.tickets ?? []).find((x) => x.id === el.dataset.id);
  if (!t) return;
  if (S.mode === 'file') { toast('Tickets open in the online app.'); return; }
  openTicketViewer({ ticket: t, load: async () => {
    try {
      return await fetchTicket(t);
    } catch (e) {
      if (e.status !== 404 || t.plain || !(await refreshTrip())) throw e;
      const fresh = (S.data.private.tickets ?? []).find((x) => x.id === t.id);
      if (!fresh) throw e;
      return fetchTicket(fresh);
    }
  } });
};

document.addEventListener('click', (event) => {
  const el = event.target.closest('[data-action]');
  if (el && ACTIONS[el.dataset.action]) ACTIONS[el.dataset.action](el);
});

document.addEventListener('input', (event) => {
  if (event.target.dataset?.input === 'ask-q' && S.ui.ask) S.ui.ask.q = event.target.value;
});

document.addEventListener('submit', (event) => {
  const form = event.target.closest('form[data-form]');
  if (!form) return;
  event.preventDefault();
  if (form.dataset.form === 'unlock') submitUnlock(form);
  if (form.dataset.form === 'open-trip') openTripLink(form.link.value);
  if (form.dataset.form === 'ask') sendAsk(form.q.value.trim());
});

window.addEventListener('hashchange', () => {
  if (parseSpecialHash(location.hash)) { boot(); return; }
  S.ui.ask = null;
  S.ui.driver = null;
  stopSpeech();
  if (S.ui.gps && parseRoute(location.hash).name !== 'stop') gpsOff(); // gpsOff renders
  else render();
  window.scrollTo(0, 0);
});

document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') render(); });
setInterval(() => { if (S.data && !S.ui.ask && document.visibilityState === 'visible') render(); }, 30000);
setInterval(() => { if (S.data) loadWeather(); }, 3600000);

boot();

return {  };
})();
})();
