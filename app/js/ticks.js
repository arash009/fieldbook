// Things ticked off on this phone (stops done, bookings made), kept per trip.
const keyFor = (tripId) => `fieldbook:ticks:${tripId}`;

export function loadTicks(tripId, storage = globalThis.localStorage) {
  try { return new Set(JSON.parse(storage.getItem(keyFor(tripId)) ?? '[]')); } catch { return new Set(); }
}

export function saveTicks(tripId, ticks, storage = globalThis.localStorage) {
  try { storage.setItem(keyFor(tripId), JSON.stringify([...ticks])); } catch { /* storage unavailable: ticks last for this session */ }
}

export function toggleTick(ticks, id) {
  const next = new Set(ticks);
  if (next.has(id)) next.delete(id); else next.add(id);
  return next;
}
