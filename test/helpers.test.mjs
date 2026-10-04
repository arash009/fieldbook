import { test } from 'node:test';
import assert from 'node:assert/strict';
import { html, raw, mapsUrl, safeUrl, hexColour, inkFor } from '../app/js/html.js';
import { parseRoute, parseSpecialHash } from '../app/js/router.js';
import { loadTicks, saveTicks, toggleTick } from '../app/js/ticks.js';
import { indexPayload, rebaseDates } from '../app/js/data.js';

test('html escapes interpolated values but not nested html', () => {
  assert.equal(String(html`<p>${'<b>&"x"'}</p>`), '<p>&lt;b&gt;&amp;&quot;x&quot;</p>');
  assert.equal(String(html`<ul>${['a', 'b'].map((x) => html`<li>${x}</li>`)}</ul>`), '<ul><li>a</li><li>b</li></ul>');
  assert.equal(String(html`${null}${false}${undefined}${0}${raw('<hr>')}`), '0<hr>');
});

test('url and colour helpers', () => {
  assert.equal(mapsUrl('Tower, Sample City'), 'https://www.google.com/maps/search/?api=1&query=Tower%2C%20Sample%20City');
  assert.equal(safeUrl('javascript:alert(1)'), null);
  assert.equal(safeUrl('https://example.com/x'), 'https://example.com/x');
  assert.equal(hexColour('#00843d'), '#00843d');
  assert.equal(hexColour('red;background:url(x)'), '#000000');
  assert.equal(inkFor('#ffd400'), '#000000');
  assert.equal(inkFor('#00843d'), '#ffffff');
});

test('parseRoute', () => {
  assert.deepEqual(parseRoute(''), { name: 'today', params: {} });
  assert.deepEqual(parseRoute('#/days'), { name: 'days', params: {} });
  assert.deepEqual(parseRoute('#/day/2030-06-01'), { name: 'day', params: { date: '2030-06-01' } });
  assert.deepEqual(parseRoute('#/stop/a-b'), { name: 'stop', params: { id: 'a-b' } });
  assert.deepEqual(parseRoute('#/bookings'), { name: 'bookings', params: {} });
  assert.deepEqual(parseRoute('#/guide'), { name: 'guide', params: {} });
  assert.deepEqual(parseRoute('#/guide/x'), { name: 'guideItem', params: { id: 'x' } });
  assert.deepEqual(parseRoute('#/info'), { name: 'info', params: {} });
  assert.deepEqual(parseRoute('#/info/food'), { name: 'infoCard', params: { id: 'food' } });
  assert.deepEqual(parseRoute('#/nonsense'), { name: 'today', params: {} });
});

test('parseSpecialHash', () => {
  assert.deepEqual(parseSpecialHash('#open=k7q2m9'), { open: 'k7q2m9' });
  assert.deepEqual(parseSpecialHash('#demo'), { demo: true });
  assert.equal(parseSpecialHash('#open=../x'), null);
  assert.equal(parseSpecialHash('#/today'), null);
});

test('ticks persist per trip and survive broken storage', () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  let t = loadTicks('trip1', storage);
  assert.equal(t.size, 0);
  t = toggleTick(t, 'stop:a');
  saveTicks('trip1', t, storage);
  assert.deepEqual([...loadTicks('trip1', storage)], ['stop:a']);
  assert.equal(loadTicks('trip2', storage).size, 0);
  assert.equal(toggleTick(t, 'stop:a').size, 0);
  const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
  assert.equal(loadTicks('trip1', broken).size, 0);
  saveTicks('trip1', t, broken);
});

test('rebaseDates shifts every YYYY-MM-DD string and nothing else', () => {
  const out = rebaseDates({ a: '2030-06-01', b: ['2030-06-02', 'x'], c: { d: '2030-06-01T10:00', e: 5 }, f: '2030-06-01/lunch' }, 3);
  assert.deepEqual(out, { a: '2030-06-04', b: ['2030-06-05', 'x'], c: { d: '2030-06-01T10:00', e: 5 }, f: '2030-06-04/lunch' });
});

test('indexPayload fills defaults and gives boards their ids', () => {
  const d = indexPayload({ trip: { days: [] }, transport: { boards: { k: { tabs: [] } } } });
  assert.equal(d.transport.boards.k.id, 'k');
  assert.deepEqual(d.transport.routes, {});
  assert.deepEqual(d.guides, []);
  assert.deepEqual(d.private, { stays: {}, config: {} });
});
