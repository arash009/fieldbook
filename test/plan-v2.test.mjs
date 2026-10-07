import { test } from 'node:test';
import assert from 'node:assert/strict';
import { entryFor, entryState, ticketFor, liveUrl } from '../app/js/plan.js';

const guides = [{ id: 'g1', entry: { booking: 'required', bookingId: 'b1' } }, { id: 'g2', entry: { booking: 'free' } }];
const trip = { bookings: [{ id: 'b1', item: 'Tickets', status: 'todo', forDate: '2030-06-01' }] };

test('entryFor prefers the stop, then the first guide with an entry', () => {
  assert.equal(entryFor(guides, { entry: { booking: 'at-door' }, guide: 'g1' }).booking, 'at-door');
  assert.equal(entryFor(guides, { guide: ['nope', 'g2'] }).booking, 'free');
  assert.equal(entryFor(guides, {}), null);
});

test('entryState turns into BOOKED once the booking is ticked or booked', () => {
  assert.deepEqual(entryState(trip, guides[0].entry, new Set()).label, 'PRE-BOOK');
  const s = entryState(trip, guides[0].entry, new Set(['booking:b1']));
  assert.equal(s.label, 'BOOKED ✓');
  assert.equal(s.kind, 'booked');
  assert.equal(entryState(trip, { booking: 'free' }, new Set()).label, 'FREE');
});

test('ticketFor matches by booking, then by stop', () => {
  const tickets = [{ id: 't1', booking: 'b1' }, { id: 't2', stop: 's9' }];
  assert.equal(ticketFor(tickets, { bookingId: 'b1' }).id, 't1');
  assert.equal(ticketFor(tickets, { stopId: 's9' }).id, 't2');
  assert.equal(ticketFor(undefined, { stopId: 's9' }), null);
});

test('liveUrl fills the train number into the operator pattern', () => {
  const transport = { liveStatus: { rail: 'http://live.example/n?num={number}', express: 'https://express.example/{number}' } };
  assert.equal(liveUrl(transport, 'FR 1234', 'rail'), 'http://live.example/n?num=1234');
  assert.equal(liveUrl(transport, 'Express 5678', 'express'), 'https://express.example/5678');
  assert.equal(liveUrl(transport, 'no number', 'rail'), null);
  assert.equal(liveUrl({}, 'FR 1', 'rail'), null);
});
