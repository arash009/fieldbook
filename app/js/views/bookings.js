// Everything to book, soonest first. Ticks on the phone count as booked.
import { html, raw, safeUrl } from '../html.js';
import { formatDay } from '../clock.js';
import { filterBookings, bookingDone, bookingTickId } from '../plan.js';

const LABEL = { todo: 'TO DO', unconfirmed: 'UNCONFIRMED', unknown: 'UNKNOWN', booked: 'BOOKED', optional: 'OPTIONAL', 'on-the-day': 'ON THE DAY' };
const FILTERS = [['todo', 'To do'], ['all', 'All'], ['done', 'Done']];

export function bookingsView(ctx) {
  const all = ctx.trip.bookings ?? [];
  const filter = ctx.ui.bookingFilter ?? 'todo';
  const list = filterBookings(all, filter, ctx.ticks);
  const left = filterBookings(all, 'todo', ctx.ticks).length;
  return html`<header class="top bar"><h1>Tickets</h1><div class="sub">Soonest first · ${left} left to do</div></header>
    <div class="body">
      <h3 class="sec">To book</h3>
      <div class="filters">${FILTERS.map(([id, label]) => html`<button type="button" class="pill${id === filter ? ' on' : ''}" aria-pressed="${id === filter}" data-action="filter" data-filter="${id}">${label}</button>`)}</div>
      ${list.length ? html`<ul class="bookings">${list.map((b) => bookingRow(ctx, b))}</ul>` : html`<p class="empty">Nothing here.</p>`}
    </div>`;
}

function bookingRow(ctx, b) {
  const ticked = ctx.ticks.has(bookingTickId(b));
  const done = bookingDone(b, ctx.ticks);
  const url = safeUrl(b.url);
  return html`<li class="bk${done ? ' done' : ''}">
    <button type="button" class="box${done ? ' on' : ''}${b.status === 'optional' ? ' dashed' : ''}" data-action="tick" data-id="${bookingTickId(b)}" aria-pressed="${ticked}" aria-label="${ticked ? 'Untick' : 'Tick'}: ${b.item}" ${b.status === 'booked' ? raw('disabled') : ''}>${done ? '✓' : ''}</button>
    <details data-key="booking:${b.id}"><summary><span class="h">${b.item}</span>
      <span class="meta"><span class="st st-${ticked ? 'ticked' : b.status}">${ticked ? 'TICKED' : LABEL[b.status] ?? b.status}</span> for ${formatDay(b.forDate)}${b.deadline ? ` · by ${formatDay(b.deadline)}` : ''}</span></summary>
      ${b.notes ? html`<p class="n">${b.notes}</p>` : ''}
      ${url ? html`<a class="btn" href="${url}" target="_blank" rel="noopener">Open the booking site</a>` : ''}
    </details>
    ${url && !done ? html`<a class="btn small" href="${url}" target="_blank" rel="noopener">Buy ›</a>` : ''}
  </li>`;
}
