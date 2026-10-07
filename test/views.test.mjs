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
  assert.match(route, /<b>Direction Martim Moniz<\/b> to <b>Miradouro de Santa Luzia<\/b>/);
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
