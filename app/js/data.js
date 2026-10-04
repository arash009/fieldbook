// Normalises a decrypted payload for the views, and moves the demo's dates to start today.
import { addDays } from './clock.js';

export function indexPayload(payload) {
  const t = payload.transport ?? {};
  const boards = Object.fromEntries(Object.entries(t.boards ?? {}).map(([id, b]) => [id, { ...b, id }]));
  return {
    trip: payload.trip,
    guides: payload.guides ?? [],
    transport: { checked: t.checked, routes: t.routes ?? {}, services: t.services ?? {}, lines: t.lines ?? {}, boards },
    private: { stays: payload.private?.stays ?? {}, config: payload.private?.config ?? {} },
  };
}

export function rebaseDates(value, offset) {
  // Dates, and keys that start with a date such as a dining reference "2030-06-01/lunch".
  if (typeof value === 'string') return value.replace(/^(\d{4}-\d{2}-\d{2})(?=$|\/)/, (d) => addDays(d, offset));
  if (Array.isArray(value)) return value.map((v) => rebaseDates(v, offset));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rebaseDates(v, offset)]));
  return value;
}
