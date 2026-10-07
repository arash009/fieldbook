// The pocket guide: city intros, then each place in trip order.
import { html, safeUrl } from '../html.js';
import { guidesInTripOrder, ticketFor } from '../plan.js';
import { entryBadge, entryCard } from './entry.js';
import { sources, notFound, backLink } from './parts.js';
import { askLine } from './ask.js';

const guideList = (ctx, guides) => html`<ul class="glist">${guides.map((g) => html`<li><a href="#/guide/${g.id}"><span class="h">${g.title}${g.entry ? html` ${entryBadge(ctx, g.entry)}` : ''}</span><span class="n">${g.city ?? ''}</span></a></li>`)}</ul>`;

export function guideListView(ctx) {
  const ordered = guidesInTripOrder(ctx.trip, ctx.guides);
  const cities = ordered.filter((g) => g.kind === 'city');
  const places = ordered.filter((g) => g.kind !== 'city');
  return html`<header class="top bar"><h1>Guide</h1><div class="sub">${places.length} place${places.length === 1 ? '' : 's'} · about 3 minutes each, read aloud</div></header>
    <div class="body">
      ${cities.length ? html`<h3 class="sec">Cities</h3>${guideList(ctx, cities)}` : ''}
      ${places.length ? html`<h3 class="sec">Places, in trip order</h3>${guideList(ctx, places)}` : html`<p class="empty">No guides in this trip.</p>`}
    </div>`;
}

export function guideView(ctx) {
  const g = ctx.guides.find((x) => x.id === ctx.route.params.id);
  if (!g) return notFound("That guide isn't in this trip.");
  const bullets = (items) => html`<ul class="dots">${items.map((x) => html`<li>${x}</li>`)}</ul>`;
  const hero = g.images?.hero;
  const thumb = (i) => g.images?.lookFor?.find((x) => x.index === i);
  const credit = (img) => html`<a class="credit" href="${safeUrl(img.page) ?? '#'}" target="_blank" rel="noopener">Photo: ${img.credit} · ${img.licence}</a>`;
  const canSpeak = Boolean(globalThis.speechSynthesis);
  return html`<header class="hero${hero ? ' has-photo' : ''}">${backLink('#/guide', 'Guide')}
      ${hero && safeUrl(hero.src) ? html`<img class="hero-img" src="${hero.src}" alt="${hero.alt}" loading="lazy">` : ''}
      <h1>${g.title}</h1><p>${g.why}</p></header>
    ${hero ? credit(hero) : ''}
    <div class="body">
      ${canSpeak ? html`<button class="listen" type="button" data-action="listen" data-id="${g.id}">${ctx.ui.speaking === g.id ? (ctx.ui.paused ? '▶ Resume' : '❚❚ Pause') : '▶ Listen'}<span>${ctx.ui.speaking === g.id ? 'tap to pause or resume' : "uses your phone's voice"}</span></button>` : ''}
      ${g.entry ? entryCard(ctx, g.entry, ticketFor(ctx.private?.tickets, { bookingId: g.entry.bookingId })) : ''}
      ${g.lookFor?.length ? html`<h3 class="sec">Look for</h3><ul class="look">${g.lookFor.map((x, i) => { const t = thumb(i); return html`<li>${t && safeUrl(t.src) ? html`<img src="${t.src}" alt="${t.alt}" loading="lazy" title="${t.credit} · ${t.licence}">` : ''}<span>${x}</span></li>`; })}</ul>` : ''}
      ${g.facts?.length ? html`<h3 class="sec">Facts</h3>${bullets(g.facts)}` : ''}
      ${g.kids?.length ? html`<h3 class="sec">For the kids</h3>${g.kids.map((k, i) => html`<details class="kid" data-key="kid:${g.id}:${i}"><summary>${k.q}</summary><p class="ans">${k.a}</p></details>`)}` : ''}
      ${g.links?.length || g.video ? html`<h3 class="sec">Read more</h3><ul class="readmore">${(g.links ?? []).map((l) => (safeUrl(l.url) ? html`<li><a href="${l.url}" target="_blank" rel="noopener">${l.label}<b>›</b></a></li>` : ''))}${g.video && safeUrl(g.video.url) ? html`<li><a href="${g.video.url}" target="_blank" rel="noopener">▶ ${g.video.label}${g.video.minutes ? ` · ${g.video.minutes} min` : ''}<b>›</b></a></li>` : ''}</ul>` : ''}
      ${askLine(ctx, g.title)}
      ${sources(g.checked, g.sources)}
    </div>`;
}
