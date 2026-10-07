// One stop in detail: transport options with later times, departure boards, meal and stay cards.
import { html, safeUrl } from '../html.js';
import { formatDay } from '../clock.js';
import { findStop, findDining, stopTickId, boardRows, guideIdsOf, entryFor, ticketFor, liveUrl } from '../plan.js';
import { lineStrip, callsAt } from './strip.js';
import { entryBadge, entryCard } from './entry.js';
import { kv, sources, mapButton, notFound, range, lineChip, backLink } from './parts.js';
import { askLine } from './ask.js';
import { mealPanel } from './meal.js';
import { stayPanel } from './stay.js';

export function stopView(ctx) {
  const found = findStop(ctx.trip, ctx.route.params.id);
  if (!found) return notFound("That stop isn't in the plan any more.");
  const { day, stop } = found;
  const route = stop.route ? ctx.transport.routes[stop.route] : null;
  const board = stop.board ? ctx.transport.boards[stop.board] : null;
  const dining = stop.dining ? findDining(ctx.trip, stop.dining) : null;
  const stay = stop.stay ? (ctx.trip.stays ?? []).find((s) => s.id === stop.stay) : null;
  const guides = guideIdsOf(stop).map((id) => ctx.guides.find((g) => g.id === id)).filter(Boolean);
  const when = stop.timeLabel ?? stop.time;
  const entry = entryFor(ctx.guides, stop);
  return html`<header class="top bar t-${stop.type}">${backLink(`#/day/${day.date}`, formatDay(day.date))}
      <h1>${stop.title}</h1><div class="sub">${when}${stop.optional ? ' · optional' : ''} ${entryBadge(ctx, entry)}</div></header>
    <div class="body">
      ${stop.notes ? html`<p class="lead">${stop.notes}</p>` : ''}
      ${entry ? entryCard(ctx, entry, ticketFor(ctx.private?.tickets, { bookingId: entry.bookingId, stopId: stop.id })) : ''}
      ${route ? routePanel(ctx, stop.id, route) : ''}
      ${board ? boardPanel(ctx, board, stop.boardTab ?? 0, day.date) : ''}
      ${dining ? mealPanel(ctx, dining) : ''}
      ${stay ? stayPanel(ctx, stay) : ''}
      ${guides.map((g) => html`<a class="btn guide-link" href="#/guide/${g.id}">✦ Guide: ${g.title}</a>`)}
      <div class="btns">${dining?.maps ? '' : mapButton(stop.maps)}<button class="btn" type="button" data-action="tick" data-id="${stopTickId(stop)}">${ctx.ticks.has(stopTickId(stop)) ? 'Mark not done' : 'Mark done'}</button></div>
      ${askLine(ctx, `${stop.title} (${formatDay(day.date)}, ${when})`, stop.title)}
    </div>`;
}

function tabs(group, labels, active) {
  return html`<div class="tabs" role="tablist">${labels.map((label, j) => html`<button type="button" role="tab" class="tab${j === active ? ' on' : ''}" aria-selected="${j === active}" data-action="tab" data-group="${group}" data-tab="${j}">${label}</button>`)}</div>`;
}

export function routePanel(ctx, key, route) {
  const group = `route:${key}`;
  const i = Math.min(ctx.ui.tabs[group] ?? 0, route.options.length - 1);
  const o = route.options[i];
  return html`<section class="panel">
    ${route.options.length > 1 ? tabs(group, route.options.map((x) => `${x.label} ${range(x.minutes)}′`), i) : html`<h3 class="sec">${o.label} · ${range(o.minutes)} min</h3>`}
    ${o.mode === 'taxi' ? taxiOption(ctx, o) : transitOption(ctx, o)}</section>`;
}

function transitOption(ctx, o) {
  const service = o.service ? ctx.transport.services[o.service] : null;
  const legs = o.legs ?? [];
  const strips = legs.map((l, i) => (l.line ? lineStrip(ctx, l, { change: legs.slice(i + 1).some((x) => x.line) }) : null));
  const lineIds = [...new Set(legs.filter((l) => l.line).map((l) => l.line))];
  const maps = lineIds.map((id) => ctx.transport.lines[id]).filter((l) => safeUrl(l?.mapUrl));
  const gps = ctx.ui.gps ?? {};
  return html`${strips.some(Boolean) ? html`<button class="pill gps${gps.on ? ' on' : ''}" type="button" data-action="gps" aria-pressed="${Boolean(gps.on)}">📍 Where am I? ${gps.on ? 'On' : 'Off'}</button>${gps.error ? html`<p class="n">${gps.error}</p>` : ''}` : ''}
    ${legs.map((l, i) => strips[i] ?? html`<ol class="legs">${legRow(ctx, l)}</ol>`)}
    ${maps.length ? html`<div class="btns">${maps.map((l) => html`<a class="btn" href="${l.mapUrl}" target="_blank" rel="noopener">🗺 ${l.name ?? l.label} map ›</a>`)}</div>` : ''}
    ${service || o.later ? html`<h3 class="sec">Going later?</h3>${kv('Runs', service?.hoursText)}${kv('Every', service?.frequency)}${kv('Leave by', o.later)}` : ''}
    ${o.fare || o.pay ? html`<h3 class="sec">Paying</h3>${kv('Fare', o.fare)}${kv('How', o.pay)}` : ''}
    ${kv('Access', o.access)}
    ${o.notes ? html`<p class="n">${o.notes}</p>` : ''}
    ${sources(o.checked ?? service?.checked ?? ctx.transport.checked, o.sources ?? service?.sources)}`;
}

function legRow(ctx, l) {
  if (l.line) {
    const stops = l.stops ? `, ${l.stops} stop${l.stops === 1 ? '' : 's'}` : '';
    return html`<li class="leg"><span class="dot">${lineChip(ctx, l.line)}</span><span><b>Direction ${l.direction}</b>${stops} to <b>${l.to}</b>${l.text ? `. ${l.text}` : ''}</span></li>`;
  }
  if (l.walk != null || l.minutes) {
    return html`<li class="leg"><span class="dot">🚶</span><span><b>Walk${l.minutes ? ` ${l.minutes} min` : ''}</b>${l.walk ? ` (${l.walk} m)` : ''}${l.text ? ` ${l.text}` : ''}</span></li>`;
  }
  return html`<li class="leg"><span class="dot">•</span><span>${l.text ?? ''}</span></li>`;
}

function taxiOption(ctx, o) {
  return html`${kv('Time', `${range(o.minutes)} min`)}${kv('Fare', o.fare)}${kv('Where', o.where)}
    ${o.notes ? html`<p class="n">${o.notes}</p>` : ''}
    ${o.driverText ? html`<div class="btns"><button class="btn p" type="button" data-action="driver" data-text="${o.driverText}">Show the driver</button></div>` : ''}
    ${sources(o.checked ?? ctx.transport.checked, o.sources)}`;
}

export function boardPanel(ctx, board, defaultTab, fallbackDate) {
  const group = `board:${board.id}`;
  const i = Math.min(ctx.ui.tabs[group] ?? defaultTab, board.tabs.length - 1);
  const tab = board.tabs[i];
  const rows = boardRows(tab, tab.date ?? board.date ?? fallbackDate, ctx.now);
  const planned = rows.find((r) => r.state === 'plan');
  const live = (r) => liveUrl(ctx.transport, r.train, r.operator);
  const head = planned ? html`<div class="btns">${live(planned) ? html`<a class="btn p" href="${live(planned)}" target="_blank" rel="noopener">Live status ›</a>` : ''}${safeUrl(board.buyUrl) ? html`<a class="btn" href="${board.buyUrl}" target="_blank" rel="noopener">Buy ticket ›</a>` : ''}</div>
    ${planned.stops?.length ? html`<h3 class="sec">Calls at · ${planned.train ?? ''}</h3>${callsAt(planned.stops)}` : ''}` : '';
  const trainLabel = (r) => (r.train && !String(r.note ?? '').includes(r.train.replace(/^\D+/, '')) ? r.train : '');
  return html`<section class="panel">
    ${board.title ? html`<h3 class="sec">${board.title}</h3>` : ''}
    ${board.tabs.length > 1 ? tabs(group, board.tabs.map((t) => t.label), i) : ''}
    ${tab.note ? html`<p class="n">${tab.note}</p>` : ''}
    ${head}
    <div class="scroll-x"><table class="board"><thead><tr><th></th>${tab.stations.map((s) => html`<th scope="col">${s}</th>`)}</tr></thead>
      <tbody>${rows.map((r) => html`<tr class="${r.state}${r.gone ? ' gone' : ''}"><td>${r.state === 'plan' ? html`<span class="tag">PLAN</span>` : r.flag ? html`<span class="tag flag">${r.flag}</span>` : ''}</td>${r.times.map((t) => html`<td class="t">${t ?? '–'}</td>`)}</tr>${r.note || live(r) || trainLabel(r) ? html`<tr class="rnote"><td></td><td colspan="${r.times.length}">${r.flag && r.state === 'plan' ? `${r.flag}: ` : ''}${[trainLabel(r), r.note].filter(Boolean).join(' · ')}${live(r) ? html`${r.note || trainLabel(r) ? ' · ' : ''}<a href="${live(r)}" target="_blank" rel="noopener">Live ›</a>` : ''}</td></tr>` : ''}`)}</tbody></table></div>
    ${board.notes ? html`<p class="n">${board.notes}</p>` : ''}
    ${sources(board.checked, board.sources)}</section>`;
}
