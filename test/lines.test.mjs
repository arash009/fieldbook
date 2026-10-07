import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findLineStop, stopsToward, legStops, distanceKm, whereOnLeg } from '../app/js/lines.js';

const line = { stops: [
  { name: 'North End', lat: 50.0, lng: 10.0 }, { name: 'Market', lat: 50.01, lng: 10.0 },
  { name: 'Old Town – Square', lat: 50.02, lng: 10.0, aliases: ['Old Town'] }, { name: 'South End', lat: 50.03, lng: 10.0 }] };
const loop = { stops: [{ name: 'A' }, { name: 'B up' }, { name: 'B down' }, { name: 'C' }],
  directions: { C: ['A', 'B up', 'C'], A: ['C', 'B down', 'A'] } };

test('findLineStop matches names and aliases, ignoring case and accents', () => {
  assert.equal(findLineStop(line, 'old town').name, 'Old Town – Square');
  assert.equal(findLineStop(line, 'MARKET').name, 'Market');
  assert.equal(findLineStop(line, 'Nowhere'), null);
});

test('stopsToward follows the terminus, reversing when needed, and uses one-way directions', () => {
  assert.deepEqual(stopsToward(line, 'South End'), ['North End', 'Market', 'Old Town – Square', 'South End']);
  assert.deepEqual(stopsToward(line, 'North End')[0], 'South End');
  assert.deepEqual(stopsToward(loop, 'A'), ['C', 'B down', 'A']);
});

test('legStops lists the ride with board, pass and alight roles', () => {
  const ride = legStops(line, { from: 'Market', to: 'South End', direction: 'South End' });
  assert.deepEqual(ride.map((s) => [s.name, s.role]), [['Market', 'board'], ['Old Town – Square', 'pass'], ['South End', 'alight']]);
  assert.equal(ride[0].lat, 50.01);
  assert.deepEqual(legStops(loop, { from: 'C', to: 'A', direction: 'A' }).map((s) => s.name), ['C', 'B down', 'A']);
});

test('legStops returns null when the leg cannot be placed', () => {
  assert.equal(legStops(line, { from: 'Market', to: 'Nowhere', direction: 'South End' }), null);
  assert.equal(legStops(line, { from: 'South End', to: 'Market', direction: 'South End' }), null);
  assert.equal(legStops(line, { to: 'Market', direction: 'South End' }), null);
  assert.equal(legStops(undefined, { from: 'a', to: 'b', direction: 'c' }), null);
});

test('distance and where-on-leg', () => {
  assert.ok(Math.abs(distanceKm({ lat: 50, lng: 10 }, { lat: 50.01, lng: 10 }) - 1.112) < 0.01);
  const ride = legStops(line, { from: 'North End', to: 'South End', direction: 'South End' });
  assert.deepEqual(whereOnLeg(ride, { lat: 50.0102, lng: 10.0 }), { index: 1, name: 'Market', km: whereOnLeg(ride, { lat: 50.0102, lng: 10.0 }).km, left: 2 });
  assert.equal(whereOnLeg(ride, { lat: 51, lng: 10 }), null);
  assert.equal(whereOnLeg([{ name: 'x' }], { lat: 50, lng: 10 }), null);
});
