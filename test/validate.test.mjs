import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validatePayload } from '../scripts/lib/validate.mjs';
import { loadTripDir } from '../scripts/lib/load.mjs';

const valid = () => ({
  format: 'fieldbook/1',
  trip: {
    meta: { title: 'Sample', startDate: '2030-06-01', endDate: '2030-06-02', timezone: 'Europe/Paris' },
    stays: [{ id: 'home', city: 'Sample', area: 'Centre', checkIn: '2030-06-01', checkOut: '2030-06-02', nights: 1 }],
    dining: [{ date: '2030-06-01', meal: 'lunch', place: 'Cafe' }],
    alerts: [{ date: '2030-06-02', title: 'Strike', text: 'Trains may be late.' }],
    bookings: [{ id: 'b1', item: 'Tickets', forDate: '2030-06-01', deadline: null, status: 'todo', url: 'https://example.com' }],
    ui: { infoCards: [{ id: 'food', title: 'Food', sections: ['dining', 'localTransport:Sample'], colour: '#15803d' }] },
    days: [{ date: '2030-06-01', city: 'Sample', title: 'One', stops: [
      { id: 's1', time: '09:00', title: 'Metro', type: 'transport', route: 'r1', maps: 'Station' },
      { id: 's2', time: '10:00', title: 'Museum', type: 'sight', guide: 'g1', maps: null },
      { id: 's3', time: '12:00', title: 'Lunch', type: 'meal', dining: '2030-06-01/lunch', stay: 'home' },
      { id: 's4', time: '15:00', title: 'Train', type: 'transport', board: 'k1', boardTab: 0 },
    ] }],
  },
  guides: [{ id: 'g1', title: 'Museum', why: 'Because.' }],
  transport: {
    lines: { l1: { label: '1', colour: '#00843d' } },
    services: { m: { hours: [{ days: [0, 1, 2, 3, 4, 5, 6], from: '05:30', to: '23:30' }] } },
    routes: { r1: { options: [
      { mode: 'metro', label: 'Metro', minutes: [10, 15], service: 'm', legs: [{ line: 'l1', direction: 'North', stops: 2, to: 'Museum' }] },
      { mode: 'taxi', label: 'Taxi', minutes: [5, 10] },
    ] } },
    boards: { k1: { date: '2030-06-01', tabs: [{ label: 'Out', stations: ['A', 'B'], plan: '15:00', rows: [{ times: ['15:00', '16:00'] }] }] } },
  },
  private: { stays: {}, config: {} },
});

test('a valid payload has no errors', () => {
  assert.deepEqual(validatePayload(valid()), []);
});

test('broken references and formats are reported', () => {
  const p = valid();
  const s = p.trip.days[0].stops;
  s[0].route = 'missing';
  s[1].guide = ['g1', 'nope'];
  s[2].dining = '2030-06-01/dinner';
  s[3].time = '9am';
  s.push({ ...s[1], id: 's2', guide: 'g1' });
  p.trip.bookings[0].status = 'maybe';
  p.trip.meta.timezone = 'Mars/Base';
  p.transport.routes.r1.options[0].legs[0].line = 'zz';
  p.trip.ui.infoCards[0].sections.push('weather');
  const errors = validatePayload(p).join('\n');
  for (const needle of ['route "missing"', 'guide "nope"', 'dining "2030-06-01/dinner"', 'time must be HH:MM', 'duplicate id "s2"', 'status "maybe"', 'Mars/Base', 'line "zz"', 'section "weather"']) {
    assert.ok(errors.includes(needle), `expected an error mentioning ${needle}\n${errors}`);
  }
});

test('loadTripDir reads the folder layout and defaults optional files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fb-load-'));
  await mkdir(join(dir, 'data'));
  await writeFile(join(dir, 'data/trip.json'), JSON.stringify(valid().trip));
  await writeFile(join(dir, 'data/guides.json'), JSON.stringify({ guides: valid().guides }));
  const p = await loadTripDir(dir);
  assert.equal(p.format, 'fieldbook/1');
  assert.equal(p.guides[0].id, 'g1');
  assert.deepEqual(p.transport, {});
  assert.deepEqual(p.private, { stays: {}, config: {}, ticketList: [] });
});

test('loadTripDir explains a missing or broken trip.json', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fb-load-'));
  await assert.rejects(loadTripDir(dir), /data\/trip.json not found/);
  await mkdir(join(dir, 'data'));
  await writeFile(join(dir, 'data/trip.json'), '{ nope');
  await assert.rejects(loadTripDir(dir), /data\/trip.json:/);
});

test('v2 fields are checked: entries, images, leg placement, live status, cities and tickets', () => {
  const p = valid();
  p.guides[0].entry = { booking: 'maybe', buyUrl: 'http://x', bookingId: 'nope' };
  p.guides[0].images = { hero: { src: 'javascript:1' } };
  p.transport.lines.l1.stops = [{ name: 'Start', lat: 1, lng: 1 }, { name: 'Museum', lat: 1, lng: 1.01 }, { name: 'North', lat: 1, lng: 1.02 }];
  p.transport.routes.r1.options[0].legs[0] = { line: 'l1', from: 'Nowhere', to: 'Museum', direction: 'North' };
  p.transport.liveStatus = { rail: 'ftp://x' };
  p.trip.cities = { X: { lat: 'a' } };
  p.private.ticketList = [{ id: 't1', label: 'Ticket', date: 'soon' }];
  const errors = validatePayload(p).join('\n');
  for (const needle of ['entry.booking "maybe"', 'buyUrl must start with https://', 'bookingId "nope" not found', 'image src must start with https://', 'can\'t place leg from "Nowhere"', 'liveStatus.rail must be an http(s) URL containing {number}', 'cities.X needs numeric lat and lng', 'ticket "t1": date must be YYYY-MM-DD', 'ticket "t1": file is required']) {
    assert.ok(errors.includes(needle), `expected an error mentioning ${needle}\n${errors}`);
  }
});

test('valid v2 fields pass', () => {
  const p = valid();
  p.guides[0].entry = { booking: 'required', buyUrl: 'https://example.com/buy', bookingId: 'b1' };
  p.guides[0].images = { hero: { src: 'https://upload.wikimedia.org/a/960px-x.jpg', page: 'https://commons.wikimedia.org/wiki/File:x.jpg' }, lookFor: [{ index: 0, src: 'https://upload.wikimedia.org/a/500px-y.jpg' }] };
  p.guides[0].links = [{ label: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/X' }];
  p.guides[0].video = { label: 'Film', url: 'https://www.youtube.com/watch?v=x', minutes: 5 };
  p.trip.days[0].stops[1].entry = { booking: 'at-door' };
  p.transport.lines.l1.stops = [{ name: 'Start', lat: 1, lng: 1 }, { name: 'Museum', lat: 1, lng: 1.01 }, { name: 'North', lat: 1, lng: 1.02 }];
  p.transport.routes.r1.options[0].legs[0] = { line: 'l1', from: 'Start', to: 'Museum', direction: 'North', stops: 1 };
  p.transport.liveStatus = { rail: 'http://live.example/{number}', express: 'https://express.example/{number}' };
  p.trip.cities = { Sample: { lat: 48.85, lng: 2.35 } };
  p.private.ticketList = [{ id: 't1', label: 'Ticket', date: '2030-06-01', file: 'ticket.pdf', booking: 'b1' }];
  assert.deepEqual(validatePayload(p), []);
});
