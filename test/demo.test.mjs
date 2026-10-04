import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadTripDir } from '../scripts/lib/load.mjs';
import { validatePayload } from '../scripts/lib/validate.mjs';

test('the demo itinerary is valid and uses every feature', async () => {
  const p = await loadTripDir(fileURLToPath(new URL('../demo/', import.meta.url)));
  assert.deepEqual(validatePayload(p), []);
  const stops = p.trip.days.flatMap((d) => d.stops);
  for (const field of ['route', 'board', 'dining', 'guide', 'stay']) assert.ok(stops.some((s) => s[field]), `some stop uses ${field}`);
  assert.ok(p.trip.alerts.length && p.trip.bookings.length && p.trip.ui.infoCards.length);
  assert.ok(p.private.stays.lisbon.address.includes('sample'));
});
