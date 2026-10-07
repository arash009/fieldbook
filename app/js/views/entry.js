// "Getting in": whether to pre-book, what it costs this group, and the official place to buy.
import { html, safeUrl } from '../html.js';
import { entryState } from '../plan.js';
import { kv, sources } from './parts.js';

export function entryBadge(ctx, entry) {
  if (!entry) return '';
  const s = entryState(ctx.trip, entry, ctx.ticks);
  return html`<span class="badge b-${s.kind}">${s.label}</span>`;
}

export function entryCard(ctx, entry, ticket) {
  const s = entryState(ctx.trip, entry, ctx.ticks);
  const buy = safeUrl(entry.buyUrl);
  return html`<section class="entry">
    <div class="row"><h3 class="sec">Getting in</h3>${entryBadge(ctx, entry)}</div>
    ${entry.summary ? html`<p class="lead">${entry.summary}</p>` : ''}
    ${kv('You pay', entry.prices)}${kv('Hours', entry.hours)}${kv('Allow', entry.allow)}${kv('Rules', entry.rules)}${kv('Dress', entry.dress)}${kv('Access', entry.access)}
    <div class="btns">${buy ? html`<a class="btn p" href="${buy}" target="_blank" rel="noopener">${s.booked ? 'Booking site ›' : 'Buy tickets ›'}</a>` : ''}${ticket ? html`<button class="btn" type="button" data-action="ticket" data-id="${ticket.id}">🎟 My ticket</button>` : ''}</div>
    ${sources(entry.checked, entry.sources)}
  </section>`;
}
