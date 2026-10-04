// All days at a glance, with alerts on top until they've passed.
import { html } from '../html.js';
import { formatDay, weekdayOf } from '../clock.js';
import { activeAlerts, alertsOn } from '../plan.js';
import { alertBanner } from './parts.js';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function daysView(ctx) {
  const { trip, now } = ctx;
  const stays = (trip.stays ?? []).map((s) => `${s.city} ${s.nights} night${s.nights === 1 ? '' : 's'}`).join(', ');
  return html`<header class="top bar"><h1>All days</h1><div class="sub">${formatDay(trip.meta.startDate)} – ${formatDay(trip.meta.endDate)}${stays ? ` · ${stays}` : ''}</div></header>
    <div class="body">${activeAlerts(trip.alerts, now).map((a) => alertBanner(a, now))}
      <ul class="days">${trip.days.map((d) => {
        const state = d.date < now.date ? 'past' : d.date === now.date ? 'today' : '';
        const warn = alertsOn(trip.alerts, d.date)[0];
        return html`<li><a class="day ${state}" href="#/day/${d.date}">
          <span class="dd"><span class="w">${WEEKDAYS[weekdayOf(d.date)]}</span><span class="d">${Number(d.date.slice(8))}</span></span>
          <span class="x"><span class="h">${d.title}${state === 'today' ? ' · today' : ''}</span>
            ${warn ? html`<span class="warn">⚠ ${warn.title}</span>` : html`<span class="city">${d.city} ${d.stops.map((s) => html`<i class="mini t-${s.type}"></i>`)}</span>`}</span></a></li>`;
      })}</ul></div>`;
}
