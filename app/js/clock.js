// Time in the trip's own time zone, whatever zone the phone's clock is set to.

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const two = (n) => String(n).padStart(2, '0');
const utcDay = (date) => {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

export function toMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function fromMinutes(mins) {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440;
  return `${two(Math.floor(m / 60))}:${two(m % 60)}`;
}

export const weekdayOf = (date) => new Date(utcDay(date)).getUTCDay();

export function addDays(date, n) {
  const t = new Date(utcDay(date) + n * 86400000);
  return `${t.getUTCFullYear()}-${two(t.getUTCMonth() + 1)}-${two(t.getUTCDate())}`;
}

export const daysBetween = (a, b) => Math.round((utcDay(b) - utcDay(a)) / 86400000);

export const makeLocal = (date, time) => ({ date, time, minutes: toMinutes(time), weekday: weekdayOf(date) });

export function localNow(timeZone, at = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(at);
  const get = (type) => parts.find((p) => p.type === type).value;
  return makeLocal(`${get('year')}-${get('month')}-${get('day')}`, `${get('hour')}:${get('minute')}`);
}

export function parseNowOverride(value) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(value ?? '');
  return m ? makeLocal(m[1], m[2]) : null;
}

export function tripPhase(meta, now) {
  if (now.date < meta.startDate) return 'before';
  if (now.date > meta.endDate) return 'after';
  return 'during';
}

export function formatDay(date) {
  const [, m, d] = date.split('-').map(Number);
  return `${WEEKDAYS[weekdayOf(date)]} ${d} ${MONTHS[m - 1]}`;
}

export function formatDate(date) {
  const [y, m, d] = date.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
