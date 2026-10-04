import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toMinutes, fromMinutes, addDays, daysBetween, weekdayOf, localNow, makeLocal, parseNowOverride, tripPhase, formatDay, formatDate } from '../app/js/clock.js';

test('toMinutes and fromMinutes round-trip and wrap past midnight', () => {
  assert.equal(toMinutes('06:45'), 405);
  assert.equal(toMinutes('nope'), null);
  assert.equal(fromMinutes(405), '06:45');
  assert.equal(fromMinutes(1440 + 30), '00:30');
});

test('date arithmetic works across month ends', () => {
  assert.equal(addDays('2030-01-31', 1), '2030-02-01');
  assert.equal(daysBetween('2030-01-30', '2030-02-02'), 3);
  assert.equal(weekdayOf('2030-06-01'), 6);
});

test('localNow reports wall time in the trip zone, not the phone zone', () => {
  const at = new Date(Date.UTC(2030, 5, 1, 19, 30));
  assert.deepEqual(localNow('Europe/Paris', at), { date: '2030-06-01', time: '21:30', minutes: 1290, weekday: 6 });
  assert.equal(localNow('Asia/Dubai', at).time, '23:30');
});

test('localNow keeps the earlier day when the phone zone has already rolled over', () => {
  const at = new Date(Date.UTC(2030, 5, 1, 21, 30));
  assert.equal(localNow('Asia/Dubai', at).date, '2030-06-02');
  assert.equal(localNow('Europe/Paris', at).date, '2030-06-01');
});

test('parseNowOverride accepts only YYYY-MM-DDTHH:MM', () => {
  assert.deepEqual(parseNowOverride('2030-06-01T06:52'), makeLocal('2030-06-01', '06:52'));
  assert.equal(parseNowOverride('tomorrow'), null);
  assert.equal(parseNowOverride(null), null);
});

test('tripPhase', () => {
  const meta = { startDate: '2030-06-01', endDate: '2030-06-03' };
  assert.equal(tripPhase(meta, makeLocal('2030-05-31', '23:59')), 'before');
  assert.equal(tripPhase(meta, makeLocal('2030-06-03', '23:59')), 'during');
  assert.equal(tripPhase(meta, makeLocal('2030-06-04', '00:00')), 'after');
});

test('formatDay and formatDate', () => {
  assert.equal(formatDay('2030-06-01'), 'Sat 1 Jun');
  assert.equal(formatDate('2030-06-01'), '1 Jun 2030');
});
