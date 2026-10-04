// A planned meal: the place, how it caters for the diet, that day's hours, a phrase to show staff, and backups.
import { html } from '../html.js';
import { kv, sources, mapButton } from './parts.js';

const MEALS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };

export function mealPanel(ctx, d) {
  const phrase = ctx.trip.ui?.dietPhrase;
  const backups = (ctx.trip.diningExtras ?? []).filter((x) => !d.city || x.city === d.city);
  const tags = d.tags ?? (d.badge ? [d.badge] : []);
  return html`<section class="panel meal">
    <h3 class="sec">${MEALS[d.meal] ?? d.meal}: ${d.place}</h3>
    ${tags.length ? html`<div class="chips">${tags.map((t) => html`<span class="chip diet">${t}</span>`)}</div>` : ''}
    ${kv('Address', d.address)}${kv('Setup', d.setup)}${kv('That day', d.hoursThatDay)}${kv('Closed', d.closed)}
    ${kv('Book', d.book === true ? 'Yes' : d.book === false ? 'No need' : null)}
    ${phrase ? html`<div class="say"><div>Say when ordering:</div><div class="big">${phrase.say}</div><div>${phrase.meaning}</div></div>` : ''}
    <div class="btns">${mapButton(d.maps, 'Open in Maps', true)}</div>
    ${backups.length ? html`<details class="more" data-key="backups:${d.date}:${d.meal}"><summary>Backups and treats nearby (${backups.length})</summary>${backups.map((b) => html`<div class="extra"><b>${b.place}</b> · ${b.where}<div class="n">${b.note}</div></div>`)}</details>` : ''}
    ${sources(ctx.trip.meta.factsCheckedBetween?.at(-1), [d.source])}
  </section>`;
}
