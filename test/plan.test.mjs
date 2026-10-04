import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeLocal } from '../app/js/clock.js';
import * as P from '../app/js/plan.js';

const day = { date: '2030-06-01', city: 'Sample', title: 'Day one', stops: [
  { id: 'a', time: '08:00', title: 'Train', type: 'transport' },
  { id: 'b', time: '09:00', title: 'Museum', type: 'sight' },
  { id: 'c', time: '12:30', title: 'Lunch', type: 'meal', dining: '2030-06-01/lunch' },
] };
const none = new Set();

test('nextStop skips ticked and long-past stops, with 15 minutes of grace', () => {
  assert.equal(P.nextStop(day, makeLocal('2030-06-01', '07:00'), none).id, 'a');
  assert.equal(P.nextStop(day, makeLocal('2030-06-01', '08:10'), none).id, 'a');
  assert.equal(P.nextStop(day, makeLocal('2030-06-01', '08:16'), none).id, 'b');
  assert.equal(P.nextStop(day, makeLocal('2030-06-01', '07:00'), new Set(['stop:a'])).id, 'b');
  assert.equal(P.nextStop(day, makeLocal('2030-06-01', '13:00'), none), null);
  assert.equal(P.nextStop(day, makeLocal('2030-05-31', '23:00'), none).id, 'a');
  assert.equal(P.nextStop(day, makeLocal('2030-06-02', '07:00'), none), null);
});

test('stopState and stopAfter', () => {
  assert.equal(P.stopState(day, day.stops[0], makeLocal('2030-06-01', '09:00'), none), 'past');
  assert.equal(P.stopState(day, day.stops[0], makeLocal('2030-06-01', '09:00'), new Set(['stop:a'])), 'done');
  assert.equal(P.stopState(day, day.stops[2], makeLocal('2030-06-01', '09:00'), none), 'upcoming');
  assert.equal(P.stopAfter(day, day.stops[0]).id, 'b');
  assert.equal(P.stopAfter(day, day.stops[2]), null);
});

test('serviceOpen handles overnight hours that belong to the previous day', () => {
  const metro = { hours: [{ days: [0, 1, 2, 3, 4], from: '05:30', to: '23:30' }, { days: [5, 6], from: '05:30', to: '01:30' }] };
  assert.equal(P.serviceOpen(metro, makeLocal('2030-06-03', '05:00')), false);
  assert.equal(P.serviceOpen(metro, makeLocal('2030-06-03', '23:45')), false);
  assert.equal(P.serviceOpen(metro, makeLocal('2030-06-01', '23:45')), true);
  assert.equal(P.serviceOpen(metro, makeLocal('2030-06-02', '01:00')), true);
  assert.equal(P.serviceOpen(metro, makeLocal('2030-06-03', '01:00')), false);
  assert.equal(P.serviceOpen(undefined, makeLocal('2030-06-03', '03:00')), true);
});

test('leavingNow gives an arrival window and flags missing the next stop', () => {
  const metro = { label: 'Metro', minutes: [55, 65], mode: 'metro' };
  assert.deepEqual(P.leavingNow(metro, makeLocal('2030-06-01', '06:52'), 480, null), { from: '07:47', to: '07:57', late: false, closed: false });
  assert.equal(P.leavingNow(metro, makeLocal('2030-06-01', '07:00'), 480, null).late, true);
  assert.equal(P.leavingNow(metro, makeLocal('2030-06-03', '04:00'), null, { hours: [{ days: [1], from: '05:30', to: '23:30' }] }).closed, true);
});

const bookings = [
  { id: 'x', item: 'X', forDate: '2030-06-03', deadline: null, status: 'todo' },
  { id: 'y', item: 'Y', forDate: '2030-06-01', deadline: null, status: 'booked' },
  { id: 'z', item: 'Z', forDate: '2030-06-05', deadline: '2030-05-20', status: 'unconfirmed' },
  { id: 'w', item: 'W', forDate: '2030-06-01', deadline: null, status: 'todo' },
];

test('sortBookings uses the deadline, else the date it is for, then status', () => {
  assert.deepEqual(P.sortBookings(bookings).map((b) => b.id), ['z', 'w', 'y', 'x']);
});

test('filterBookings counts ticks as done', () => {
  const ticks = new Set(['booking:w']);
  assert.deepEqual(P.filterBookings(bookings, 'todo', ticks).map((b) => b.id), ['z', 'x']);
  assert.deepEqual(P.filterBookings(bookings, 'done', ticks).map((b) => b.id), ['w', 'y']);
  assert.equal(P.filterBookings(bookings, 'all', ticks).length, 4);
});

test('boardRows marks past, planned and later departures', () => {
  const tab = { stations: ['A', 'B'], plan: '09:28', rows: [{ times: ['08:28', '09:32'] }, { times: ['09:28', '10:32'] }, { times: ['10:28', '11:32'] }] };
  assert.deepEqual(P.boardRows(tab, '2030-06-01', makeLocal('2030-06-01', '09:40')).map((r) => [r.state, r.gone]), [['past', true], ['plan', true], ['later', false]]);
  assert.deepEqual(P.boardRows(tab, '2030-06-02', makeLocal('2030-06-01', '09:40')).map((r) => r.state), ['later', 'plan', 'later']);
});

test('alerts stay active until their day has passed', () => {
  const alerts = [{ date: '2030-06-02', title: 'Strike' }];
  assert.equal(P.activeAlerts(alerts, makeLocal('2030-06-02', '23:00')).length, 1);
  assert.equal(P.activeAlerts(alerts, makeLocal('2030-06-03', '00:01')).length, 0);
  assert.equal(P.alertsOn(alerts, '2030-06-02').length, 1);
});

test('lookups', () => {
  const trip = { days: [day], dining: [{ date: '2030-06-01', meal: 'lunch', place: 'Cafe' }] };
  assert.equal(P.findStop(trip, 'b').stop.title, 'Museum');
  assert.equal(P.findStop(trip, 'nope'), null);
  assert.equal(P.findDining(trip, '2030-06-01/lunch').place, 'Cafe');
  assert.deepEqual(P.guideIdsOf({ guide: 'g1' }), ['g1']);
  assert.deepEqual(P.guideIdsOf({ guide: ['g1', 'g2'] }), ['g1', 'g2']);
  assert.deepEqual(P.guideIdsOf({}), []);
});

test('guidesInTripOrder: cities first, then by first mention, unmentioned last', () => {
  const trip = { days: [{ date: '2030-06-01', stops: [{ id: 's1', guide: 'b' }, { id: 's2', guide: ['a', 'b'] }] }] };
  const guides = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'city', kind: 'city' }];
  assert.deepEqual(P.guidesInTripOrder(trip, guides).map((g) => g.id), ['city', 'b', 'a', 'c']);
});

test('askContext describes time, day, next stop, what is viewed and ticked bookings', () => {
  const trip = { meta: { startDate: '2030-06-01', endDate: '2030-06-01', timezone: 'Europe/Paris' }, days: [day], bookings: [{ id: 'm', item: 'Museum tickets' }] };
  const text = P.askContext({ trip, now: makeLocal('2030-06-01', '08:30'), ticks: new Set(['booking:m']), viewing: 'Museum (Sat 1 Jun, 09:00)' });
  assert.equal(text, [
    "It's Sat 1 Jun, 08:30 local time (Europe/Paris).",
    'Day 1 of 1: Day one, in Sample.',
    'Next stop: Museum at 09:00.',
    "I'm looking at: Museum (Sat 1 Jun, 09:00).",
    'Marked as booked on my phone: Museum tickets.',
  ].join('\n'));
  const before = P.askContext({ trip, now: makeLocal('2030-05-30', '10:00'), ticks: none, viewing: '' });
  assert.match(before, /The trip starts Sat 1 Jun\./);
});
