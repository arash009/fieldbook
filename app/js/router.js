// Hash routes: #/today, #/days, #/day/<date>, #/stop/<id>, #/bookings, #/guide[/<id>], #/info[/<card>].
export function parseRoute(hash) {
  const parts = (hash ?? '').replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean).map(decodeURIComponent);
  const [head, arg] = parts;
  if (head === 'days') return { name: 'days', params: {} };
  if (head === 'day' && arg) return { name: 'day', params: { date: arg } };
  if (head === 'stop' && arg) return { name: 'stop', params: { id: arg } };
  if (head === 'bookings') return { name: 'bookings', params: {} };
  if (head === 'guide') return arg ? { name: 'guideItem', params: { id: arg } } : { name: 'guide', params: {} };
  if (head === 'info') return arg ? { name: 'infoCard', params: { id: arg } } : { name: 'info', params: {} };
  return { name: 'today', params: {} };
}

// One-off links: #open=<trip id> remembers a trip, #demo starts the sample trip.
export function parseSpecialHash(hash) {
  const open = /^#open=([a-z0-9]{4,32})$/i.exec(hash ?? '');
  if (open) return { open: open[1].toLowerCase() };
  return hash === '#demo' ? { demo: true } : null;
}
