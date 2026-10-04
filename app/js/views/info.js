// Quick-reference cards. Each card lists sections of the itinerary to show (see docs/itinerary-format.md).
import { html, safeUrl, hexColour, inkFor } from '../html.js';
import { formatDay, formatDate } from '../clock.js';
import { kv, sources, paceBox, notFound, backLink } from './parts.js';
import { askButton } from './ask.js';
import { boardPanel } from './stop.js';
import { mealPanel } from './meal.js';
import { stayPanel } from './stay.js';

export function infoCards(trip) {
  if (trip.ui?.infoCards?.length) return trip.ui.infoCards;
  const cards = (trip.localTransport ?? []).map((t, i) => ({ id: `transport-${i}`, title: `${t.city} transport`, icon: '➜', colour: '#00843d', sections: [`localTransport:${t.city}`] }));
  if (trip.transfers?.length) cards.push({ id: 'transfers', title: 'Transfers', icon: '🚕', colour: '#ffd400', sections: ['transfers'] });
  if (trip.dining?.length) cards.push({ id: 'food', title: 'Food', icon: '🍴', colour: '#15803d', sections: ['dining', 'diningExtras'] });
  cards.push({ id: 'boards', title: 'Trains', icon: '🚆', colour: '#334155', sections: ['boards'] });
  if (trip.tips?.length) cards.push({ id: 'tips', title: 'Tips', icon: '★', colour: '#c2410c', sections: ['tips'] });
  if (trip.stays?.length) cards.push({ id: 'stays', title: 'Stays', icon: '🏠', colour: '#4338ca', sections: ['stays'] });
  if (trip.flights) cards.push({ id: 'flights', title: 'Flights', icon: '✈', colour: '#0f172a', sections: ['flights'] });
  if (trip.links?.length) cards.push({ id: 'links', title: 'Links', icon: '🔗', colour: '#000000', sections: ['links'] });
  return cards;
}

export function infoView(ctx) {
  const { trip } = ctx;
  const [from, to] = trip.meta.factsCheckedBetween ?? [];
  const checked = from && /^\d{4}/.test(from) ? (from === to || !to ? formatDate(from) : `${formatDay(from)} – ${formatDate(to)}`) : null;
  return html`<header class="top bar"><div class="row"><div><h1>Info</h1>${checked ? html`<div class="sub">Quick cards · checked ${checked}</div>` : ''}</div>${askButton(ctx)}</div></header>
    <div class="body">
      <div class="igrid">${infoCards(trip).map((c) => html`<a class="icard" href="#/info/${c.id}"><span class="tile" style="background:${hexColour(c.colour)};color:${inkFor(c.colour)}" aria-hidden="true">${c.icon ?? '•'}</span><span class="h">${c.title}</span>${c.subtitle ? html`<span class="s">${c.subtitle}</span>` : ''}</a>`)}</div>
      ${paceBox(trip)}
      <div class="btns"><button class="btn" type="button" data-action="${ctx.mode === 'demo' ? 'leave-demo' : 'lock'}">${ctx.mode === 'demo' ? 'Leave the demo' : 'Lock this phone'}</button></div>
    </div>`;
}

export function infoCardView(ctx) {
  const card = infoCards(ctx.trip).find((c) => c.id === ctx.route.params.id);
  if (!card) return notFound("That card isn't in this trip.");
  return html`<header class="top bar">${backLink('#/info', 'Info')}<h1>${card.title}</h1>${card.subtitle ? html`<div class="sub">${card.subtitle}</div>` : ''}</header>
    <div class="body">${(card.sections ?? []).map((s) => section(ctx, s))}</div>`;
}

function section(ctx, spec) {
  const at = spec.indexOf(':');
  const name = at < 0 ? spec : spec.slice(0, at);
  const arg = at < 0 ? null : spec.slice(at + 1);
  const t = ctx.trip;
  switch (name) {
    case 'transfer': return transfer((t.transfers ?? []).find((x) => x.id === arg));
    case 'transfers': return html`${(t.transfers ?? []).map(transfer)}`;
    case 'localTransport': return localTransport(ctx, (t.localTransport ?? []).find((x) => x.city === arg));
    case 'dining': return html`${(t.dining ?? []).map((d) => html`<details class="more" data-key="dining:${d.date}:${d.meal}"><summary><b>${formatDay(d.date)} · ${d.meal}</b> · ${d.place}</summary>${mealPanel(ctx, d)}</details>`)}`;
    case 'diningExtras': return extras(t.diningExtras ?? []);
    case 'boards': return html`${Object.values(ctx.transport.boards).map((b) => boardPanel(ctx, b, 0, b.date ?? t.meta.startDate))}`;
    case 'tips': return html`${(t.tips ?? []).map((x) => html`<details class="more" data-key="tip:${x.topic}"><summary><b>${x.topic}</b></summary><p>${x.text}</p>${sources(null, [x.source])}</details>`)}`;
    case 'stays': return html`${(t.stays ?? []).map((s) => stayPanel(ctx, s))}`;
    case 'flights': return flights(t.flights);
    case 'links': return html`<ul class="links">${(t.links ?? []).map((l) => (safeUrl(l.url) ? html`<li><a class="btn" href="${l.url}" target="_blank" rel="noopener">${l.label}</a></li>` : ''))}</ul>`;
    case 'travellers': return paceBox(t);
    default: return '';
  }
}

function transfer(x) {
  if (!x) return '';
  return html`<section class="panel"><h3 class="sec">${x.title}</h3>${x.summary ? html`<p>${x.summary}</p>` : ''}
    ${(x.options ?? []).map((o) => html`<div class="opt-card${o.mode === x.recommended ? ' rec' : ''}"><div class="h">${o.mode}${o.mode === x.recommended ? ' · recommended' : ''}</div>${o.summary ? html`<p class="n">${o.summary}</p>` : ''}${kv('Cost', o.cost)}${o.notes ? html`<p class="n">${o.notes}</p>` : ''}</div>`)}
    ${x.ticketNotes ? html`<p class="n">${x.ticketNotes}</p>` : ''}</section>`;
}

function localTransport(ctx, lt) {
  if (!lt) return '';
  const st = lt.stops ?? {};
  return html`<section class="panel"><p class="lead">${lt.summary}</p>
    ${kv('Into town', st.intoTown)}${kv('Back', st.backFromTown)}${kv('Station', st.station)}${st.note ? html`<p class="n">${st.note}</p>` : ''}
    ${lt.routes?.length ? html`<h3 class="sec">Routes</h3>${lt.routes.map((r) => html`<div class="opt-card"><div class="h">${r.to}</div><p class="n">${r.how}</p>${kv('Time', r.minutes)}</div>`)}` : ''}
    ${kv('Every', lt.frequency)}${kv('Hours', lt.hours)}${kv('Fare', lt.fare)}${kv('How to pay', lt.howToPay)}${kv('Access', lt.accessibility)}${kv('Taxi', lt.taxiFallback)}
    ${lt.notes?.length ? html`<ul class="plain">${lt.notes.map((n) => html`<li>${n}</li>`)}</ul>` : ''}
    ${sources(ctx.trip.meta.factsCheckedBetween?.at(-1), lt.sources)}</section>`;
}

function extras(list) {
  const kinds = [...new Set(list.map((x) => x.kind))];
  return html`${kinds.map((k) => html`<h3 class="sec">${k}</h3>${list.filter((x) => x.kind === k).map((x) => html`<div class="extra"><b>${x.place}</b>${x.city ? ` · ${x.city}` : ''}<div class="n">${x.where}</div><div class="n">${x.note}</div></div>`)}`)}`;
}

function flights(f) {
  if (!f) return '';
  return html`<section class="panel">${(f.segments ?? []).map((s) => html`<div class="opt-card"><div class="h">${s.flight} · ${formatDay(s.date)}</div><p class="n">${s.fromName} ${s.depart} → ${s.toName} ${s.arrive}${s.arriveDate && s.arriveDate !== s.date ? ` (${formatDay(s.arriveDate)})` : ''}</p></div>`)}
    ${kv('Status', f.status)}${kv('Baggage', f.baggage)}${kv('Price seen', f.priceSeen)}</section>`;
}
