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
