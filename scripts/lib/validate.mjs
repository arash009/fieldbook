// Checks an itinerary payload. Returns a list of plain-English problems; an empty list means it's valid.
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const HEX = /^#[0-9a-f]{6}$/i;
export const STOP_TYPES = ['transport', 'sight', 'meal', 'rest', 'logistics'];
export const BOOKING_STATUSES = ['booked', 'todo', 'unconfirmed', 'unknown', 'optional', 'on-the-day'];
export const MODES = ['metro', 'tram', 'train', 'bus', 'ferry', 'taxi', 'walk'];
export const SECTIONS = ['transfer', 'transfers', 'localTransport', 'dining', 'diningExtras', 'boards', 'tips', 'stays', 'links', 'flights', 'travellers'];

function uniqueIds(list, where, err) {
  const ids = new Set();
  for (const item of list) {
    if (!item.id) err(`${where}: every entry needs an id`);
    else if (ids.has(item.id)) err(`${where}: duplicate id "${item.id}"`);
    else ids.add(item.id);
  }
  return ids;
}

function checkTransport(transport, err) {
  const { lines = {}, services = {}, routes = {}, boards = {} } = transport ?? {};
  for (const [id, l] of Object.entries(lines)) {
    if (!l.label) err(`line "${id}": label is required`);
    if (!HEX.test(l.colour ?? '')) err(`line "${id}": colour must be #rrggbb`);
  }
  for (const [id, s] of Object.entries(services)) for (const h of s.hours ?? []) {
    if (!Array.isArray(h.days) || h.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) err(`service "${id}": days must be numbers 0 (Sun) to 6 (Sat)`);
    if (!TIME.test(h.from ?? '') || !TIME.test(h.to ?? '')) err(`service "${id}": from and to must be HH:MM`);
  }
  for (const [id, r] of Object.entries(routes)) {
    if (!Array.isArray(r.options) || !r.options.length) { err(`route "${id}": needs at least one option`); continue; }
    r.options.forEach((o, i) => {
      const w = `route "${id}" option ${i}`;
      if (!MODES.includes(o.mode)) err(`${w}: mode "${o.mode}" is not one of ${MODES.join(', ')}`);
      if (!o.label) err(`${w}: label is required`);
      if (!Array.isArray(o.minutes) || o.minutes.length !== 2 || !(o.minutes[0] <= o.minutes[1])) err(`${w}: minutes must be [min, max]`);
      if (o.service && !services[o.service]) err(`${w}: service "${o.service}" not found`);
      for (const leg of o.legs ?? []) if (leg.line && !lines[leg.line]) err(`${w}: line "${leg.line}" not found`);
    });
  }
  for (const [id, b] of Object.entries(boards)) {
    if (!Array.isArray(b.tabs) || !b.tabs.length) { err(`board "${id}": needs at least one tab`); continue; }
    if (b.date && !DATE.test(b.date)) err(`board "${id}": date must be YYYY-MM-DD`);
    b.tabs.forEach((tab, i) => {
      const w = `board "${id}" tab ${i}`;
      if (!Array.isArray(tab.stations) || tab.stations.length < 2) err(`${w}: needs at least two stations`);
      if (tab.plan != null && !TIME.test(tab.plan)) err(`${w}: plan must be HH:MM`);
      (tab.rows ?? []).forEach((row, j) => {
        if (!Array.isArray(row.times) || row.times.length !== tab.stations?.length) err(`${w} row ${j}: needs one time per station`);
        else if (!TIME.test(row.times[0] ?? '')) err(`${w} row ${j}: the first time is required`);
        else if (row.times.some((x) => x !== null && !TIME.test(x))) err(`${w} row ${j}: times must be HH:MM or null`);
      });
    });
  }
  return { routes, boards };
}

function checkStop(s, where, refs, err) {
  if (!s.id) err(`${where}: id is required`);
  else if (!/^[a-z0-9-]+$/.test(s.id)) err(`${where}: id may use only a-z, 0-9 and -`);
  else if (refs.stopIds.has(s.id)) err(`${where}: duplicate id "${s.id}"`);
  else refs.stopIds.add(s.id);
  if (!TIME.test(s.time ?? '')) err(`${where}: time must be HH:MM`);
  if (!STOP_TYPES.includes(s.type)) err(`${where}: type "${s.type}" is not one of ${STOP_TYPES.join(', ')}`);
  if (s.maps != null && typeof s.maps !== 'string') err(`${where}: maps must be a search text or null`);
  for (const g of [s.guide ?? []].flat()) if (!refs.guideIds.has(g)) err(`${where}: guide "${g}" not found`);
  if (s.dining && !refs.diningKeys.has(s.dining)) err(`${where}: dining "${s.dining}" not found`);
  if (s.route && !refs.routes[s.route]) err(`${where}: route "${s.route}" not found`);
  if (s.board && !refs.boards[s.board]) err(`${where}: board "${s.board}" not found`);
  else if (s.board && s.boardTab != null && !refs.boards[s.board].tabs?.[s.boardTab]) err(`${where}: boardTab ${s.boardTab} not found`);
  if (s.stay && !refs.stayIds.has(s.stay)) err(`${where}: stay "${s.stay}" not found`);
}

export function validatePayload(payload) {
  const errors = [];
  const err = (msg) => errors.push(msg);
  const trip = payload?.trip;
  if (!trip?.meta) return ['trip.meta is missing'];
  const { startDate, endDate, timezone } = trip.meta;
  if (!DATE.test(startDate ?? '')) err('meta.startDate must be YYYY-MM-DD');
  if (!DATE.test(endDate ?? '')) err('meta.endDate must be YYYY-MM-DD');
  if (startDate > endDate) err('meta.startDate is after meta.endDate');
  if (!timezone) err('meta.timezone is missing');
  else try { new Intl.DateTimeFormat('en', { timeZone: timezone }); } catch { err(`meta.timezone "${timezone}" is not a valid time zone`); }

  const guides = Array.isArray(payload.guides) ? payload.guides : [];
  const guideIds = uniqueIds(guides, 'guides', err);
  for (const g of guides) if (!g.title || !g.why) err(`guide "${g.id}": title and why are required`);

  const { routes, boards } = checkTransport(payload.transport, err);
  const stayIds = uniqueIds(trip.stays ?? [], 'stays', err);
  const diningKeys = new Set();
  for (const d of trip.dining ?? []) {
    const key = `${d.date}/${d.meal}`;
    if (diningKeys.has(key)) err(`dining "${key}" is listed twice`);
    diningKeys.add(key);
    if (!d.place) err(`dining "${key}": place is required`);
  }

  const refs = { stopIds: new Set(), guideIds, diningKeys, routes, boards, stayIds };
  (trip.days ?? []).forEach((day, i) => {
    const w = `days[${i}]`;
    if (!DATE.test(day.date ?? '')) err(`${w}: date must be YYYY-MM-DD`);
    else if (day.date < startDate || day.date > endDate) err(`${w} (${day.date}): outside the trip dates`);
    if (i > 0 && !(day.date > trip.days[i - 1].date)) err(`${w} (${day.date}): days must be in date order with no repeats`);
    if (!day.title) err(`${w}: title is required`);
    (day.stops ?? []).forEach((s, j) => checkStop(s, `${w} (${day.date}) stop ${j} "${s.title}"`, refs, err));
  });

  uniqueIds(trip.bookings ?? [], 'bookings', err);
  for (const b of trip.bookings ?? []) {
    if (!BOOKING_STATUSES.includes(b.status)) err(`booking "${b.id}": status "${b.status}" is not one of ${BOOKING_STATUSES.join(', ')}`);
    if (!DATE.test(b.forDate ?? '')) err(`booking "${b.id}": forDate must be YYYY-MM-DD`);
    if (b.deadline != null && !DATE.test(b.deadline)) err(`booking "${b.id}": deadline must be YYYY-MM-DD or null`);
    if (b.url != null && !/^https:\/\//.test(b.url)) err(`booking "${b.id}": url must start with https://`);
  }
  for (const a of trip.alerts ?? []) {
    if (!a.title) err('alerts: every alert needs a title');
    if (!DATE.test(a.date ?? '')) err(`alert "${a.title}": date must be YYYY-MM-DD`);
  }
  const cards = trip.ui?.infoCards ?? [];
  uniqueIds(cards, 'ui.infoCards', err);
  for (const c of cards) {
    if (c.colour && !HEX.test(c.colour)) err(`info card "${c.id}": colour must be #rrggbb`);
    for (const s of c.sections ?? []) if (!SECTIONS.includes(s.split(':')[0])) err(`info card "${c.id}": section "${s}" is not one of ${SECTIONS.join(', ')}`);
  }
  return errors;
}
