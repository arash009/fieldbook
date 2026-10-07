import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadTripDir } from '../scripts/lib/load.mjs';
import { indexPayload } from '../app/js/data.js';
import { makeLocal } from '../app/js/clock.js';
import { parseRoute } from '../app/js/router.js';
import { todayView, dayView } from '../app/js/views/day.js';
import { daysView } from '../app/js/views/days.js';
import { askText, askUrl } from '../app/js/views/ask.js';
import { stopView } from '../app/js/views/stop.js';
import { bookingsView } from '../app/js/views/bookings.js';
import { guideListView, guideView } from '../app/js/views/guide.js';
import { infoView, infoCardView, infoCards } from '../app/js/views/info.js';
import { renderApp } from '../app/js/views/shell.js';
import { landingView } from '../app/js/views/landing.js';
import { unlockView } from '../app/js/views/unlock.js';
import { entryCard, entryBadge } from '../app/js/views/entry.js';
import { lineStrip } from '../app/js/views/strip.js';

const demo = indexPayload(await loadTripDir(fileURLToPath(new URL('../demo/', import.meta.url))));
const ctxAt = (date, time, hash = '#/today', extra = {}) => ({
  ...demo, mode: 'demo', now: makeLocal(date, time), ticks: new Set(), ui: { tabs: {} }, route: parseRoute(hash), ...extra,
});

test('Today before, during and after the trip', () => {
  assert.match(String(todayView(ctxAt('2030-05-30', '10:00'))), /Starts in 2 days/);
  const during = String(todayView(ctxAt('2030-06-01', '09:00')));
  assert.match(during, /Old town and the castle/);
  assert.match(during, /Leaving now \(09:00\)\?/);
  assert.match(during, /Sample alert/);
  assert.match(String(todayView(ctxAt('2030-06-03', '10:00'))), /Trip over/);
});

test('the next card moves on as stops are ticked or pass', () => {
  assert.match(String(todayView(ctxAt('2030-06-01', '11:00'))), /Next · 12:30/);
  const ticked = String(todayView(ctxAt('2030-06-01', '09:00', '#/today', { ticks: new Set(['stop:d1-tram-castle']) })));
  assert.match(ticked, /Next · 10:15/);
});

test('a day with a board shows the next departures', () => {
  const out = String(todayView(ctxAt('2030-06-02', '14:50')));
  assert.match(out, /Next departures/);
  assert.match(out, /15:02 Belém/);
});

test('day view and days list', () => {
  assert.match(String(dayView(ctxAt('2030-06-01', '09:00', '#/day/2030-06-02'))), /Belém by the river/);
  assert.match(String(dayView(ctxAt('2030-06-01', '09:00', '#/day/2031-01-01'))), /Not found/);
  const days = String(daysView(ctxAt('2030-06-02', '09:00', '#/days')));
  assert.match(days, /class="day past"/);
  assert.match(days, /Belém by the river · today/);
});

test('data is escaped in every view', () => {
  const ctx = ctxAt('2030-06-01', '09:00');
  const evil = structuredClone(ctx.trip);
  evil.days[0].title = '<img src=x onerror=alert(1)>';
  assert.doesNotMatch(String(todayView({ ...ctx, trip: evil })), /<img src=x/);
});

test('ask text and url', () => {
  const ctx = ctxAt('2030-06-01', '09:00', '#/today', { ui: { tabs: {}, ask: { viewing: 'São Jorge Castle' } } });
  const text = askText(ctx, 'Is it open?');
  assert.match(text, /^It's Sat 1 Jun, 09:00 local time \(Europe\/Lisbon\)\./);
  assert.match(text, /I'm looking at: São Jorge Castle\.\n\nIs it open\?$/);
  assert.equal(askUrl({ claudeProjectUrl: 'https://claude.ai/new', prefillParam: 'q' }, 'hi there'), 'https://claude.ai/new?q=hi+there');
  assert.equal(askUrl({ claudeProjectUrl: 'https://claude.ai/project/abc' }, 'x'), 'https://claude.ai/project/abc');
  assert.equal(askUrl({ claudeProjectUrl: '' }, 'x'), null);
});

test('stop detail: route tabs, taxi tab, board, meal and stay panels', () => {
  const route = String(stopView(ctxAt('2030-06-01', '09:00', '#/stop/d1-tram-castle')));
  assert.match(route, /<b>Direction Martim Moniz<\/b> · 3 stops[\s\S]*Rua da Conceição[\s\S]*BOARD[\s\S]*Miradouro de Santa Luzia[\s\S]*GET OFF/);
  assert.match(route, /Tram 28 map ›/);
  assert.match(route, /Going later\?/);
  const taxi = String(stopView(ctxAt('2030-06-01', '09:00', '#/stop/d1-tram-castle', { ui: { tabs: { 'route:d1-tram-castle': 1 } } })));
  assert.match(taxi, /Show the driver/);
  const board = String(stopView(ctxAt('2030-06-02', '15:10', '#/stop/d2-train')));
  assert.match(board, /<tr class="plan gone">/);
  assert.match(board, /LAST/);
  const meal = String(stopView(ctxAt('2030-06-01', '09:00', '#/stop/d1-lunch')));
  assert.match(meal, /Sou vegetariano/);
  assert.match(meal, /Pastry stop/);
  const stay = String(stopView(ctxAt('2030-06-01', '09:00', '#/stop/d1-rest')));
  assert.match(stay, /Rua Exemplo 10/);
  assert.match(String(stopView(ctxAt('2030-06-01', '09:00', '#/stop/zzz'))), /Not found/);
});

test('bookings: filters and ticks', () => {
  const todo = String(bookingsView(ctxAt('2030-05-30', '09:00', '#/bookings')));
  assert.match(todo, /3 left to do/);
  assert.ok(todo.indexOf('Jerónimos Monastery tickets') < todo.indexOf('São Jorge Castle tickets'), 'deadline sorts first');
  const ticked = String(bookingsView(ctxAt('2030-05-30', '09:00', '#/bookings', { ticks: new Set(['booking:castle']), ui: { tabs: {}, bookingFilter: 'done' } })));
  assert.match(ticked, /TICKED/);
  assert.match(ticked, /Apartment in the Baixa/);
});

test('guide list and page', () => {
  const list = String(guideListView(ctxAt('2030-06-01', '09:00', '#/guide')));
  assert.ok(list.indexOf('Lisbon') < list.indexOf('São Jorge Castle') && list.indexOf('São Jorge Castle') < list.indexOf('Belém Tower'));
  const page = String(guideView(ctxAt('2030-06-01', '09:00', '#/guide/belem-tower')));
  assert.match(page, /Can you find the rhino\?/);
  assert.match(page, /en\.wikipedia\.org/);
});

test('info cards render every section type', () => {
  const ctx = ctxAt('2030-06-01', '09:00', '#/info');
  assert.match(String(infoView(ctx)), /Getting around/);
  for (const card of infoCards(ctx.trip)) {
    const out = String(infoCardView({ ...ctx, route: parseRoute(`#/info/${card.id}`) }));
    assert.doesNotMatch(out, /Not found/, card.id);
  }
  assert.match(String(infoCardView({ ...ctx, route: parseRoute('#/info/stay') })), /Show the driver/);
});

test('shell picks the view, the active tab, sheets and the demo ribbon', () => {
  const out = renderApp(ctxAt('2030-06-01', '09:00', '#/guide/castle', { ui: { tabs: {}, ask: { viewing: 'São Jorge Castle', q: '' }, driver: 'Castelo de São Jorge' } }));
  assert.match(String(out.main), /Sample trip/);
  assert.match(String(out.main), /Ask Claude/);
  assert.match(String(out.main), /class="driver"/);
  assert.match(String(out.nav), /href="#\/guide" class="on"/);
});

test('landing and unlock screens', () => {
  assert.match(String(landingView()), /Try the demo/);
  assert.match(String(unlockView({ error: "That passphrase didn't work." })), /role="alert"/);
  assert.match(String(unlockView({ busy: true })), /Unlocking…/);
});

test('the demo still links meals, boards and days after its dates are moved to today', async () => {
  const { rebaseDates } = await import('../app/js/data.js');
  const raw = await loadTripDir(fileURLToPath(new URL('../demo/', import.meta.url)));
  const moved = indexPayload(rebaseDates(raw, 100));
  const day1 = moved.trip.days[0].date;
  const ctx = { ...moved, mode: 'demo', now: makeLocal(day1, '09:00'), ticks: new Set(), ui: { tabs: {} }, route: parseRoute('#/stop/d1-lunch') };
  assert.match(String(stopView(ctx)), /Sou vegetariano/);
  assert.match(String(todayView({ ...ctx, route: parseRoute('#/today') })), /Leaving now/);
});

test('entry card: badge, buy link, booked state and ticket button', () => {
  const ctx = ctxAt('2030-06-01', '09:00');
  const entry = { booking: 'required', bookingId: 'castle', summary: 'Book a slot.', buyUrl: 'https://castelodesaojorge.pt/en/', prices: 'Adults €15', hours: '09:00–21:00', sources: [], checked: '2030-05-01' };
  const card = String(entryCard(ctx, entry, null));
  assert.match(card, /PRE-BOOK/);
  assert.match(card, /href="https:\/\/castelodesaojorge\.pt\/en\/"[^>]*>Buy tickets ›/);
  const booked = String(entryCard({ ...ctx, ticks: new Set(['booking:castle']) }, entry, { id: 't1' }));
  assert.match(booked, /BOOKED ✓/);
  assert.match(booked, /data-action="ticket" data-id="t1"/);
  assert.equal(String(entryBadge(ctx, null)), '');
});

test('the Tickets tab replaces Book and booking rows show a buy button', () => {
  const out = renderApp(ctxAt('2030-05-30', '09:00', '#/bookings'));
  assert.match(String(out.nav), /Tickets/);
  assert.match(String(out.main), /class="btn small"[^>]*href="https:\/\/castelodesaojorge\.pt\/en\/"|href="https:\/\/castelodesaojorge\.pt\/en\/"[^>]*class="btn small"/);
});

test('guide page shows the photo with its credit, read-more links and Listen', () => {
  const ctx = ctxAt('2030-06-01', '09:00', '#/guide/belem-tower');
  const g = ctx.guides.find((x) => x.id === 'belem-tower');
  const withMedia = { ...g, images: { hero: { src: 'https://upload.wikimedia.org/x/960px-Tower.jpg', page: 'https://commons.wikimedia.org/wiki/File:Tower.jpg', alt: 'The tower', credit: 'A. Person', licence: 'CC BY-SA 4.0' }, lookFor: [{ index: 0, src: 'https://upload.wikimedia.org/x/500px-Rhino.jpg', page: 'https://commons.wikimedia.org/wiki/File:Rhino.jpg', alt: 'Rhino', credit: 'B', licence: 'CC0' }] }, links: [{ label: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Bel%C3%A9m_Tower' }], video: { label: 'Short film', url: 'https://www.youtube.com/watch?v=x', minutes: 5 } };
  globalThis.speechSynthesis = {};
  const out = String(guideView({ ...ctx, guides: ctx.guides.map((x) => (x.id === g.id ? withMedia : x)) }));
  delete globalThis.speechSynthesis;
  assert.match(out, /<img[^>]+src="https:\/\/upload\.wikimedia\.org\/x\/960px-Tower\.jpg"[^>]+loading="lazy"/);
  assert.match(out, /A\. Person · CC BY-SA 4\.0/);
  assert.match(out, /500px-Rhino\.jpg/);
  assert.match(out, /Read more/);
  assert.match(out, /Short film · 5 min/);
  assert.match(out, /data-action="listen" data-id="belem-tower"/);
});

const stripCtx = () => {
  const ctx = ctxAt('2030-06-01', '09:00', '#/stop/d1-tram-castle');
  ctx.transport = { ...ctx.transport, lines: { ...ctx.transport.lines, 'lis-28': { ...ctx.transport.lines['lis-28'], mapUrl: 'https://www.carris.pt/en/', stops: [
    { name: 'Martim Moniz', lat: 38.7158, lng: -9.1359 }, { name: 'Rua da Conceição', lat: 38.7105, lng: -9.1368 }, { name: 'Sé', lat: 38.7099, lng: -9.1327 },
    { name: 'Miradouro de Santa Luzia', lat: 38.7118, lng: -9.1300 }] } } };
  return ctx;
};

test('a tram leg with from/to/direction draws a strip with board and get-off stops', () => {
  const ctx = stripCtx();
  const out = String(lineStrip(ctx, { line: 'lis-28', from: 'Rua da Conceição', to: 'Miradouro de Santa Luzia', direction: 'Miradouro de Santa Luzia' }, {}));
  assert.match(out, /Rua da Conceição[\s\S]*BOARD[\s\S]*Sé[\s\S]*Miradouro de Santa Luzia[\s\S]*GET OFF/);
  assert.match(out, /2 stops/);
  const near = String(lineStrip({ ...ctx, ui: { tabs: {}, gps: { on: true, pos: { lat: 38.7100, lng: -9.1328 } } } }, { line: 'lis-28', from: 'Rua da Conceição', to: 'Miradouro de Santa Luzia', direction: 'Miradouro de Santa Luzia' }, {}));
  assert.match(near, /YOU'RE HERE/);
  assert.match(near, /1 stop to Miradouro de Santa Luzia/);
  assert.equal(lineStrip(ctx, { line: 'lis-28', to: 'Sé', direction: 'Sé' }, {}), null);
});

test('boards link each train to its live status and show calls-at for the plan', () => {
  const ctx = ctxAt('2030-06-02', '14:00', '#/stop/d2-train');
  const b = ctx.transport.boards['belem-cais'];
  ctx.transport = { ...ctx.transport, liveStatus: { rail: 'https://live.example/{number}' }, boards: { ...ctx.transport.boards, 'belem-cais': { ...b, buyUrl: 'https://www.cp.pt/', tabs: [{ ...b.tabs[0], rows: b.tabs[0].rows.map((r) => ({ ...r, train: `CP ${r.times[0].replace(':', '')}`, operator: 'rail', ...(r.times[0] === '15:02' ? { stops: [{ name: 'Belém', time: '15:02' }, { name: 'Cais do Sodré', time: '15:10' }] } : {}) })) }] } } };
  const out = String(stopView(ctx));
  assert.match(out, /href="https:\/\/live\.example\/1502"[^>]*>Live status ›/);
  assert.match(out, /href="https:\/\/www\.cp\.pt\/"[^>]*>Buy ticket ›/);
  assert.match(out, /Calls at/);
  assert.match(out, /href="https:\/\/live\.example\/1422"/);
});

test('a board row names its train once, even when the note already gives the number', () => {
  const ctx = ctxAt('2030-06-02', '14:00', '#/stop/d2-train');
  const b = ctx.transport.boards['belem-cais'];
  const rows = b.tabs[0].rows.map((r) => (r.times[0] === '14:22' ? { ...r, train: 'CP 1422', note: 'Sample: service 1422' } : r.times[0] === '14:42' ? { ...r, train: 'CP 1442' } : r));
  ctx.transport = { ...ctx.transport, boards: { ...ctx.transport.boards, 'belem-cais': { ...b, tabs: [{ ...b.tabs[0], rows }] } } };
  const out = String(stopView(ctx));
  assert.doesNotMatch(out, /CP 1422/);
  assert.match(out, /CP 1442/);
});

test('the day header shows the forecast when there is one', () => {
  const weather = { '2030-06-01': { icon: '☀', text: 'Clear', max: 24, min: 16, rain: 10, sunset: '21:05' } };
  assert.match(String(dayView(ctxAt('2030-06-01', '09:00', '#/day/2030-06-01', { weather }))), /Clear · 24° \/ 16° · 10% rain · sunset 21:05/);
  assert.doesNotMatch(String(dayView(ctxAt('2030-06-01', '09:00', '#/day/2030-06-02', { weather }))), /class="wx"/);
});

test('the Tickets tab lists tickets with today first', () => {
  const ctx = ctxAt('2030-06-02', '09:00', '#/bookings');
  ctx.private = { ...ctx.private, tickets: [{ id: 'a', label: 'Castle', date: '2030-06-01', mime: 'image/png' }, { id: 'b', label: 'Monastery', date: '2030-06-02', mime: 'application/pdf' }] };
  const out = String(renderApp(ctx).main);
  assert.ok(out.indexOf('Monastery') < out.indexOf('Castle'));
  assert.match(out, /data-action="ticket" data-id="b"/);
});
