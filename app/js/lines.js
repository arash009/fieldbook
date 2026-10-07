// Which stops a metro or tram ride passes, and which one the rider is nearest.
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

export function findLineStop(line, name) {
  const n = norm(name);
  return (line?.stops ?? []).find((s) => norm(s.name) === n || (s.aliases ?? []).some((a) => norm(a) === n)) ?? null;
}

export function stopsToward(line, direction) {
  const end = findLineStop(line, direction);
  if (line?.directions) {
    const key = Object.keys(line.directions).find((k) => norm(k) === norm(direction) || (end && norm(findLineStop(line, k)?.name) === norm(end.name)));
    if (key) return line.directions[key];
  }
  if (!end) return null;
  const names = line.stops.map((s) => s.name);
  return norm(end.name) === norm(names[0]) ? [...names].reverse() : names;
}

export function legStops(line, leg) {
  if (!line?.stops?.length || !leg?.from || !leg.to || !leg.direction) return null;
  const order = stopsToward(line, leg.direction);
  const from = findLineStop(line, leg.from);
  const to = findLineStop(line, leg.to);
  if (!order || !from || !to) return null;
  const i = order.findIndex((n) => norm(n) === norm(from.name));
  const j = order.findIndex((n) => norm(n) === norm(to.name));
  if (i < 0 || j <= i) return null;
  return order.slice(i, j + 1).map((name, k, arr) => ({ ...findLineStop(line, name), name, role: k === 0 ? 'board' : k === arr.length - 1 ? 'alight' : 'pass' }));
}

export function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function whereOnLeg(stops, pos, maxKm = 1.5) {
  let best = null;
  stops.forEach((s, index) => {
    if (typeof s.lat !== 'number' || typeof s.lng !== 'number') return;
    const km = distanceKm(pos, s);
    if (!best || km < best.km) best = { index, km };
  });
  if (!best || best.km > maxKm) return null;
  return { index: best.index, name: stops[best.index].name, km: best.km, left: stops.length - 1 - best.index };
}
