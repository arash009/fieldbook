// Small building blocks shared by the screens.
import { html, mapsUrl, safeUrl, hexColour, inkFor } from '../html.js';
import { addDays, formatDay, formatDate } from '../clock.js';

const TYPE_ICON = { transport: '➜', sight: '★', meal: '🍴', rest: '☾', logistics: '▣' };

export const range = ([lo, hi]) => (lo === hi ? `${lo}` : `${lo}–${hi}`);

export function short(text, max = 90) {
  if (!text) return '';
  const first = text.split(/(?<=[.!?])\s/)[0];
  return first.length <= max ? first : `${first.slice(0, max - 1).trimEnd()}…`;
}

const colourTile = (bg, label) => html`<span class="tile" style="background:${hexColour(bg)};color:${inkFor(bg)}" aria-hidden="true">${label}</span>`;

export function tile(ctx, stop, done = false) {
  if (done) return html`<span class="tile done" aria-hidden="true">✓</span>`;
  if (stop.type === 'transport') {
    const leg = ctx.transport.routes[stop.route]?.options?.[0]?.legs?.find((l) => l.line);
    const line = leg && ctx.transport.lines[leg.line];
    if (line) return colourTile(line.colour, line.label);
    if (stop.board) return html`<span class="tile t-transport" aria-hidden="true">🚆</span>`;
  }
  return html`<span class="tile t-${stop.type}" aria-hidden="true">${TYPE_ICON[stop.type] ?? '•'}</span>`;
}

export function lineChip(ctx, lineId) {
  const line = ctx.transport.lines[lineId];
  if (!line) return '';
  return html`<span class="chip" style="background:${hexColour(line.colour)};color:${inkFor(line.colour)}" title="${line.name ?? line.label}">${line.label}</span>`;
}

export function routeChips(ctx, route) {
  return html`<div class="chips">${route.options.map((o) => (o.mode === 'taxi'
    ? html`<span class="chip taxi">Taxi ${range(o.minutes)} min${o.fareShort ? ` · ${o.fareShort}` : ''}</span>`
    : html`${(o.legs ?? []).filter((l) => l.line).map((l) => lineChip(ctx, l.line))}<span class="chip out">${o.label} ~${range(o.minutes)} min</span>`))}</div>`;
}

export const kv = (k, v) => (v ? html`<div class="kv"><span class="k">${k}</span><span class="v">${v}</span></div>` : '');

export function sources(checked, list = []) {
  const links = (list ?? []).map(safeUrl).filter(Boolean);
  if (!checked && !links.length) return '';
  const when = !checked ? '' : /^\d{4}-\d{2}-\d{2}$/.test(checked) ? `Checked ${formatDate(checked)}` : checked;
  return html`<p class="src">${when}${links.map((u, i) => html`${when || i ? ' · ' : ''}<a href="${u}" target="_blank" rel="noopener">${new URL(u).hostname.replace(/^www\./, '')}</a>`)}</p>`;
}

export const mapButton = (query, label = 'Map', primary = false) => (query
  ? html`<a class="btn${primary ? ' p' : ''}" href="${mapsUrl(query)}" target="_blank" rel="noopener">📍 ${label}</a>`
  : '');

export function alertBanner(alert, now) {
  const when = alert.date === now.date ? 'Today' : alert.date === addDays(now.date, 1) ? 'Tomorrow' : formatDay(alert.date);
  return html`<details class="alert" data-key="alert:${alert.date}:${alert.title}"><summary><b>⚠ ${when}: ${alert.title}</b></summary><p>${alert.text}</p>${sources(alert.checked, alert.sources)}</details>`;
}

export function paceBox(trip) {
  const notes = [...(trip.travellers?.mobility ?? []), ...(trip.travellers?.dietary ?? [])];
  if (!notes.length && !trip.meta.pace) return '';
  return html`<div class="pace">${trip.meta.pace ? html`<p><b>Pace:</b> ${trip.meta.pace}</p>` : ''}${notes.length ? html`<ul>${notes.map((n) => html`<li>${n}</li>`)}</ul>` : ''}</div>`;
}

export const backLink = (href, label) => html`<a class="back" href="${href}">‹ ${label}</a>`;

export const notFound = (message) => html`<header class="top bar">${backLink('#/today', 'Today')}<h1>Not found</h1></header><div class="body"><p>${message}</p></div>`;
