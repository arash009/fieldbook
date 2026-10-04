// "Ask Claude": builds the context for a question and hands it to the Claude app.
import { html, raw, safeUrl } from '../html.js';
import { askContext } from '../plan.js';
import { short } from './parts.js';

export const DEFAULT_CHIPS = [
  "We're running late. What now?",
  'Is the transport running right now?',
  'Somewhere nearby that suits our diet?',
  'Tell the kids something fun about this place',
];

export const askAvailable = (ctx) => Boolean(safeUrl(ctx.private?.config?.claudeProjectUrl));

export const askButton = (ctx) => (askAvailable(ctx)
  ? html`<button class="ask" type="button" data-action="ask" data-viewing="">✳ Ask Claude</button>` : '');

export const askLine = (ctx, viewing) => (askAvailable(ctx)
  ? html`<button class="askline" type="button" data-action="ask" data-viewing="${viewing}">✳ Ask Claude about ${short(viewing, 48)}</button>` : '');

export function askText(ctx, question) {
  const context = askContext({ trip: ctx.trip, now: ctx.now, ticks: ctx.ticks, viewing: ctx.ui.ask?.viewing || '' });
  return question ? `${context}\n\n${question}` : context;
}

export function askUrl(config, text) {
  const base = safeUrl(config?.claudeProjectUrl);
  if (!base) return null;
  if (!config.prefillParam) return base;
  const url = new URL(base);
  url.searchParams.set(config.prefillParam, text);
  return url.toString();
}

export function askSheet(ctx) {
  const ask = ctx.ui.ask;
  const chips = ctx.trip.ui?.askChips ?? DEFAULT_CHIPS;
  const online = globalThis.navigator?.onLine !== false;
  return html`<div class="sheet-wrap" role="dialog" aria-modal="true" aria-labelledby="ask-title">
    <button class="dim" type="button" data-action="ask-close" aria-label="Close"></button>
    <form class="sheet" data-form="ask">
      <h2 id="ask-title">Ask Claude</h2>
      <div class="ctx"><b>Sent with your question:</b><div class="pre">${askText(ctx, '')}</div></div>
      <textarea name="q" rows="3" placeholder="Type a question…" data-input="ask-q">${ask.q ?? ''}</textarea>
      <div class="chips">${chips.map((c) => html`<button type="button" class="pill" data-action="ask-chip" data-q="${c}">${c}</button>`)}</div>
      <button class="go" type="submit" ${online ? '' : raw('disabled')}>${online ? 'Open in Claude app ›' : 'Needs signal'}</button>
      <p class="fine">Copies your question and the context above, then opens Claude. Paste and send if it isn't filled in already.</p>
      ${ask.fallback ? html`<label class="fine">Copy this by hand:<textarea readonly class="copybox">${ask.fallback}</textarea></label>` : ''}
    </form></div>`;
}
