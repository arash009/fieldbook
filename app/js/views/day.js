// Today and any single day: alerts, the "next" card with leaving-now estimates, and the stop list.
import { html, mapsUrl } from '../html.js';
import { formatDay, toMinutes, tripPhase, daysBetween } from '../clock.js';
import { nextStop, stopAfter, stopState, stopTickId, leavingNow, activeAlerts, findDining, filterBookings, boardRows, entryFor } from '../plan.js';
import { entryBadge } from './entry.js';
import { tile, routeChips, alertBanner, paceBox, short, mapButton, notFound } from './parts.js';
import { askButton } from './ask.js';

export function todayView(ctx) {
  const { trip, now } = ctx;
  const phase = tripPhase(trip.meta, now);
  if (phase === 'before') return beforeTrip(ctx);
  const day = trip.days.find((d) => d.date === now.date);
  return phase === 'after' || !day ? afterTrip(ctx) : dayScreen(ctx, day);
}

export function dayView(ctx) {
  const day = ctx.trip.days.find((d) => d.date === ctx.route.params.date);
  return day ? dayScreen(ctx, day) : notFound("That day isn't in the plan.");
}

function dayScreen(ctx, day) {
  const { trip, now, ticks } = ctx;
  const idx = trip.days.indexOf(day);
  const next = day.date === now.date ? nextStop(day, now, ticks) : null;
  const pace = paceBox(trip);
  return html`<header class="top"><div class="row"><div>
      <div class="date">${formatDay(day.date)} · ${day.city} · Day ${idx + 1} of ${trip.days.length}</div>
      <h1>${day.title}</h1></div>${askButton(ctx)}</div></header>
    <div class="body">
      ${activeAlerts(trip.alerts, now).map((a) => alertBanner(a, now))}
      ${pace && !ticks.has(`pace:${day.date}`) ? html`<div class="pace-once">${pace}<button class="btn small" type="button" data-action="tick" data-id="pace:${day.date}">Got it</button></div>` : ''}
      ${next ? nextCard(ctx, day, next) : ''}
      <ol class="stops">${day.stops.map((s) => stopRow(ctx, day, s, s === next))}</ol>
      ${dayNav(trip, idx)}
    </div>`;
}

function nextCard(ctx, day, stop) {
  const route = stop.route ? ctx.transport.routes[stop.route] : null;
  const board = stop.board ? ctx.transport.boards[stop.board] : null;
  const after = stopAfter(day, stop);
  return html`<section class="next">
    <div class="lbl">Next · ${stop.timeLabel ?? stop.time}${after ? ` · then ${after.title} ${after.time}` : ''}</div>
    <h2>${stop.title}</h2>
    ${route ? routeChips(ctx, route) : ''}
    ${route ? leavingBox(ctx, route, after ? toMinutes(after.time) : null) : ''}
    ${board ? nextDepartures(ctx, day, stop, board) : ''}
    ${!route && !board && stop.notes ? html`<p class="n">${short(stop.notes, 160)}</p>` : ''}
    <div class="btns"><a class="btn p" href="#/stop/${stop.id}">${route || board ? 'Options & later times' : 'Details'}</a>${mapButton(stop.maps)}</div>
  </section>`;
}

function leavingBox(ctx, route, target) {
  return html`<div class="now"><b>Leaving now (${ctx.now.time})?</b>${route.options.map((o) => {
    const r = leavingNow(o, ctx.now, target, o.service ? ctx.transport.services[o.service] : null);
    return html`<div class="r${r.late ? ' late' : ''}"><span>${o.label}</span><b>${r.closed ? 'not running now' : `arrive ${r.from}–${r.to}${r.late ? ' · late' : ''}`}</b></div>`;
  })}</div>`;
}

function nextDepartures(ctx, day, stop, board) {
  const tab = board.tabs[stop.boardTab ?? 0] ?? board.tabs[0];
  const rows = boardRows(tab, tab.date ?? board.date ?? day.date, ctx.now).filter((r) => !r.gone).slice(0, 3);
  const last = tab.stations.length - 1;
  return html`<div class="now"><b>Next departures</b>${rows.length
    ? rows.map((r) => html`<div class="r"><span>${r.times[0]} ${tab.stations[0]}</span><b>${r.times[last] ?? '–'} ${tab.stations[last]}${r.state === 'plan' ? ' · plan' : ''}</b></div>`)
    : html`<div class="r">No more listed today</div>`}</div>`;
}

export function stopRow(ctx, day, stop, isNext) {
  const state = stopState(day, stop, ctx.now, ctx.ticks);
  const dining = stop.dining ? findDining(ctx.trip, stop.dining) : null;
  const done = state === 'done';
  const entry = stop.type === 'sight' ? entryFor(ctx.guides, stop) : null;
  return html`<li class="stop ${state}${isNext ? ' is-next' : ''}">
    <button class="tick" type="button" data-action="tick" data-id="${stopTickId(stop)}" aria-pressed="${done}" aria-label="${done ? 'Mark not done' : 'Mark done'}: ${stop.title}">${tile(ctx, stop, done)}</button>
    <a class="stop-main" href="#/stop/${stop.id}">
      <span class="tm${stop.timeLabel ? ' label' : ''}">${stop.timeLabel ?? stop.time}</span>
      <span class="x"><span class="h">${stop.title}${stop.optional ? html` <span class="opt">optional</span>` : ''}${entry ? html` ${entryBadge(ctx, entry)}` : ''}</span>
        ${dining?.badge ? html`<span class="chip diet">${dining.badge}</span>` : stop.notes ? html`<span class="n">${short(stop.notes)}</span>` : ''}</span>
    </a>
    ${stop.maps ? html`<a class="map" href="${mapsUrl(stop.maps)}" target="_blank" rel="noopener" aria-label="Map: ${stop.title}">📍</a>` : ''}
  </li>`;
}

function dayNav(trip, idx) {
  const prev = trip.days[idx - 1];
  const next = trip.days[idx + 1];
  return html`<nav class="daynav" aria-label="Other days">${prev ? html`<a class="btn" href="#/day/${prev.date}">‹ ${formatDay(prev.date)}</a>` : html`<span></span>`}${next ? html`<a class="btn" href="#/day/${next.date}">${formatDay(next.date)} ›</a>` : ''}</nav>`;
}

function beforeTrip(ctx) {
  const { trip, now } = ctx;
  const n = daysBetween(now.date, trip.meta.startDate);
  const first = trip.days[0];
  const todo = filterBookings(trip.bookings ?? [], 'todo', ctx.ticks).slice(0, 5);
  return html`<header class="top"><div class="row"><div><div class="date">${trip.meta.title}</div>
      <h1>Starts in ${n} day${n === 1 ? '' : 's'}</h1><div class="sub">${formatDay(trip.meta.startDate)} – ${formatDay(trip.meta.endDate)}</div></div>${askButton(ctx)}</div></header>
    <div class="body">
      ${activeAlerts(trip.alerts, now).map((a) => alertBanner(a, now))}
      ${todo.length ? html`<h3 class="sec">Still to book</h3><ul class="plain">${todo.map((b) => html`<li><a href="#/bookings">${b.item}</a> <span class="n">for ${formatDay(b.forDate)}</span></li>`)}</ul>` : ''}
      ${first ? html`<h3 class="sec">Day 1 · ${formatDay(first.date)} · ${first.title}</h3><ol class="stops">${first.stops.map((s) => stopRow(ctx, first, s, false))}</ol>` : ''}
      <div class="btns"><a class="btn" href="#/days">All days</a></div>
    </div>`;
}

const afterTrip = (ctx) => html`<header class="top"><div class="date">${ctx.trip.meta.title}</div><h1>Trip over</h1></header>
  <div class="body"><p>Welcome home. Everything from the trip is still here.</p><div class="btns"><a class="btn p" href="#/days">All days</a></div></div>`;
