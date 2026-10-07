// Boots the app: landing page, demo, a remembered encrypted trip, or a single-file backup.
import { localNow, parseNowOverride, daysBetween, addDays } from './clock.js';
import { forecastUrl, parseForecast } from './weather.js';
import { open, openWithKey } from './crypto.js';
import { loadKey, saveKey, forgetKey } from './keystore.js';
import { loadTicks, saveTicks, toggleTick } from './ticks.js';
import { indexPayload, rebaseDates } from './data.js';
import { parseRoute, parseSpecialHash } from './router.js';
import { renderApp } from './views/shell.js';
import { landingView, messageView } from './views/landing.js';
import { unlockView } from './views/unlock.js';
import { askText, askUrl } from './views/ask.js';
import { speechChunks } from './speech.js';

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
    try { ready(await openWithKey(envelope, stored.key)); return; } catch { /* the passphrase changed: ask again */ }
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
  }, (e) => gpsOff(e.code === 1 ? 'Location is blocked for this site. Allow it in Chrome settings to use Where am I?' : "Couldn't get your location."), { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });
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
