// What's next, what's late and what's left to book. Pure functions over the itinerary.
import { toMinutes, fromMinutes, formatDay } from './clock.js';

export const STOP_TYPES = ['transport', 'sight', 'meal', 'rest', 'logistics'];
export const BOOKING_STATUSES = ['unconfirmed', 'unknown', 'todo', 'optional', 'on-the-day', 'booked'];
const GRACE_MINUTES = 15;
const STATUS_RANK = Object.fromEntries(BOOKING_STATUSES.map((s, i) => [s, i]));

export const stopTickId = (stop) => `stop:${stop.id}`;
export const bookingTickId = (booking) => `booking:${booking.id}`;

export function stopState(day, stop, now, ticks) {
  if (ticks.has(stopTickId(stop))) return 'done';
  if (day.date < now.date) return 'past';
  if (day.date > now.date) return 'upcoming';
  return toMinutes(stop.time) + GRACE_MINUTES < now.minutes ? 'past' : 'upcoming';
}

export const nextStop = (day, now, ticks) => day.stops.find((s) => stopState(day, s, now, ticks) === 'upcoming') ?? null;

export function stopAfter(day, stop) {
  const i = day.stops.indexOf(stop);
  return i >= 0 ? day.stops[i + 1] ?? null : null;
}

// hours: [{ days: [0–6], from, to }]. A `to` earlier than `from` runs past midnight into the next day.
export function serviceOpen(service, now) {
  if (!service?.hours?.length) return true;
  const yesterday = (now.weekday + 6) % 7;
  return service.hours.some((h) => {
    const from = toMinutes(h.from);
    const to = toMinutes(h.to);
    if (to > from) return h.days.includes(now.weekday) && now.minutes >= from && now.minutes < to;
    return (h.days.includes(now.weekday) && now.minutes >= from) || (h.days.includes(yesterday) && now.minutes < to);
  });
}

export function leavingNow(option, now, targetMinutes, service) {
  const [lo, hi] = option.minutes;
  return {
    from: fromMinutes(now.minutes + lo),
    to: fromMinutes(now.minutes + hi),
    late: targetMinutes != null && now.minutes + hi > targetMinutes,
    closed: service ? !serviceOpen(service, now) : false,
  };
}

export const bookingDone = (b, ticks) => b.status === 'booked' || ticks.has(bookingTickId(b));
const due = (b) => b.deadline ?? b.forDate ?? '9999-12-31';

export const sortBookings = (list) =>
  [...list].sort((a, b) => due(a).localeCompare(due(b)) || (STATUS_RANK[a.status] ?? 99) - (STATUS_RANK[b.status] ?? 99));

export function filterBookings(list, filter, ticks) {
  const sorted = sortBookings(list);
  if (filter === 'done') return sorted.filter((b) => bookingDone(b, ticks));
  if (filter === 'todo') return sorted.filter((b) => !bookingDone(b, ticks) && ['todo', 'unconfirmed', 'unknown'].includes(b.status));
  return sorted;
}

export function boardRows(tab, date, now) {
  return tab.rows.map((row) => {
    const dep = row.times[0];
    const gone = date < now.date || (date === now.date && toMinutes(dep) < now.minutes);
    return { ...row, gone, state: dep === tab.plan ? 'plan' : gone ? 'past' : 'later' };
  });
}

export const activeAlerts = (alerts = [], now) => alerts.filter((a) => a.date >= now.date);
export const alertsOn = (alerts = [], date) => alerts.filter((a) => a.date === date);

export const findDining = (trip, key) => (trip.dining ?? []).find((d) => `${d.date}/${d.meal}` === key) ?? null;

export function findStop(trip, id) {
  for (const day of trip.days ?? []) {
    const stop = day.stops.find((s) => s.id === id);
    if (stop) return { day, stop };
  }
  return null;
}

export const guideIdsOf = (stop) => (stop.guide == null ? [] : [stop.guide].flat());

export function guidesInTripOrder(trip, guides = []) {
  const order = [];
  for (const day of trip.days ?? []) for (const s of day.stops ?? []) for (const id of guideIdsOf(s)) if (!order.includes(id)) order.push(id);
  const rank = (g) => (g.kind === 'city' ? -1 : order.includes(g.id) ? order.indexOf(g.id) : order.length);
  return [...guides].sort((a, b) => rank(a) - rank(b));
}

export function askContext({ trip, now, ticks, viewing }) {
  const lines = [`It's ${formatDay(now.date)}, ${now.time} local time (${trip.meta.timezone}).`];
  const idx = (trip.days ?? []).findIndex((d) => d.date === now.date);
  if (idx >= 0) {
    const day = trip.days[idx];
    lines.push(`Day ${idx + 1} of ${trip.days.length}: ${day.title}, in ${day.city}.`);
    const next = nextStop(day, now, ticks);
    if (next) lines.push(`Next stop: ${next.title} at ${next.timeLabel ?? next.time}.`);
  } else if (now.date < trip.meta.startDate) {
    lines.push(`The trip starts ${formatDay(trip.meta.startDate)}.`);
  }
  if (viewing) lines.push(`I'm looking at: ${viewing}.`);
  const booked = (trip.bookings ?? []).filter((b) => ticks.has(bookingTickId(b))).map((b) => b.item);
  if (booked.length) lines.push(`Marked as booked on my phone: ${booked.join('; ')}.`);
  return lines.join('\n');
}

export const ENTRY_LABEL = { required: 'PRE-BOOK', recommended: 'BOOK AHEAD', 'at-door': 'AT THE DOOR', free: 'FREE' };

export function entryFor(guides, stop) {
  if (stop.entry) return stop.entry;
  for (const id of guideIdsOf(stop)) {
    const g = (guides ?? []).find((x) => x.id === id);
    if (g?.entry) return g.entry;
  }
  return null;
}

export function entryState(trip, entry, ticks) {
  const booking = entry.bookingId ? (trip.bookings ?? []).find((b) => b.id === entry.bookingId) ?? null : null;
  const booked = booking ? bookingDone(booking, ticks) : false;
  return { booked, booking, kind: booked ? 'booked' : entry.booking, label: booked ? 'BOOKED ✓' : ENTRY_LABEL[entry.booking] ?? entry.booking };
}

export function ticketFor(tickets, { bookingId, stopId } = {}) {
  const list = tickets ?? [];
  return (bookingId && list.find((t) => t.booking === bookingId)) || (stopId && list.find((t) => t.stop === stopId)) || null;
}

export function liveUrl(transport, train, operator) {
  const pattern = transport?.liveStatus?.[operator];
  const number = /(\d{2,5})/.exec(train ?? '')?.[1];
  if (!pattern || !number) return null;
  const url = pattern.replace('{number}', number);
  return /^https?:\/\/[^\s"'<>]+$/.test(url) ? url : null;
}
