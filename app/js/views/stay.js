// A place to stay. Private details (address, host) come from the encrypted part of the trip.
import { html, safeUrl } from '../html.js';
import { formatDay } from '../clock.js';
import { kv, mapButton } from './parts.js';

export function stayPanel(ctx, stay) {
  const p = ctx.private?.stays?.[stay.id] ?? {};
  const address = typeof p.address === 'string' && p.address ? p.address : null;
  const listing = safeUrl(p.listingUrl);
  return html`<section class="panel stay">
    <h3 class="sec">${stay.city} · ${stay.area}</h3>
    ${kv('Dates', `${formatDay(stay.checkIn)} → ${formatDay(stay.checkOut)} · ${stay.nights} night${stay.nights === 1 ? '' : 's'}`)}
    ${kv('Check-in', stay.checkInFrom ? `from ${stay.checkInFrom}` : null)}${kv('Check-out', stay.checkOutBy ? `by ${stay.checkOutBy}` : null)}
    ${kv('How', stay.checkInMethod)}${kv('Address', address ?? p.addressNote)}${kv('Host', p.host)}${kv('Reg. code', p.registrationCode)}${kv('Sleeps', stay.sleeps)}
    ${stay.notes ? html`<p class="n">${stay.notes}</p>` : ''}
    ${stay.amenities?.length ? html`<ul class="plain">${stay.amenities.map((a) => html`<li>${a}</li>`)}</ul>` : ''}
    <div class="btns">${address ? html`<button class="btn p" type="button" data-action="driver" data-text="${address}">Show the driver</button>` : ''}${mapButton(address ?? stay.maps)}${listing ? html`<a class="btn" href="${listing}" target="_blank" rel="noopener">Listing</a>` : ''}</div>
  </section>`;
}
