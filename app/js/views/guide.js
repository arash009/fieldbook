// The pocket guide: city intros, then each place in trip order.
import { html } from '../html.js';
import { guidesInTripOrder } from '../plan.js';
import { sources, notFound, backLink } from './parts.js';
import { askLine } from './ask.js';

const guideList = (guides) => html`<ul class="glist">${guides.map((g) => html`<li><a href="#/guide/${g.id}"><span class="h">${g.title}</span><span class="n">${g.city ?? ''}</span></a></li>`)}</ul>`;

export function guideListView(ctx) {
  const ordered = guidesInTripOrder(ctx.trip, ctx.guides);
  const cities = ordered.filter((g) => g.kind === 'city');
  const places = ordered.filter((g) => g.kind !== 'city');
  return html`<header class="top bar"><h1>Guide</h1><div class="sub">${places.length} place${places.length === 1 ? '' : 's'} · about 3 minutes each, read aloud</div></header>
    <div class="body">
      ${cities.length ? html`<h3 class="sec">Cities</h3>${guideList(cities)}` : ''}
      ${places.length ? html`<h3 class="sec">Places, in trip order</h3>${guideList(places)}` : html`<p class="empty">No guides in this trip.</p>`}
    </div>`;
}

export function guideView(ctx) {
  const g = ctx.guides.find((x) => x.id === ctx.route.params.id);
  if (!g) return notFound("That guide isn't in this trip.");
  const bullets = (items) => html`<ul class="dots">${items.map((x) => html`<li>${x}</li>`)}</ul>`;
  return html`<header class="hero">${backLink('#/guide', 'Guide')}<h1>${g.title}</h1><p>${g.why}</p></header>
    <div class="body">
      ${g.lookFor?.length ? html`<h3 class="sec">Look for</h3>${bullets(g.lookFor)}` : ''}
      ${g.facts?.length ? html`<h3 class="sec">Facts</h3>${bullets(g.facts)}` : ''}
      ${g.kids?.length ? html`<h3 class="sec">For the kids</h3>${g.kids.map((k, i) => html`<details class="kid" data-key="kid:${g.id}:${i}"><summary>${k.q}</summary><p class="ans">${k.a}</p></details>`)}` : ''}
      ${askLine(ctx, g.title)}
      ${sources(g.checked, g.sources)}
    </div>`;
}
