// A metro or tram ride drawn as a strip of stops, with the rider's nearest stop when GPS is on.
import { html, hexColour } from '../html.js';
import { legStops, whereOnLeg } from '../lines.js';
import { lineChip } from './parts.js';

export function lineStrip(ctx, leg, { change = false } = {}) {
  const line = ctx.transport.lines[leg.line];
  const stops = legStops(line, leg);
  if (!stops) return null;
  const here = ctx.ui.gps?.pos ? whereOnLeg(stops, ctx.ui.gps.pos) : null;
  const n = stops.length - 1;
  const last = stops[n].name;
  return html`<div class="strip" style="--c:${hexColour(line.colour)}">
    <div class="strip-head">${lineChip(ctx, leg.line)} <b>Direction ${leg.direction}</b> · ${n} stop${n === 1 ? '' : 's'}</div>
    <ol class="strip-stops">${stops.map((s, i) => html`<li class="${s.role}${here?.index === i ? ' here' : ''}"><span>${s.name}</span>${s.role === 'board' ? html`<b class="tag">BOARD</b>` : ''}${s.role === 'alight' ? html`<b class="tag">${change ? 'CHANGE' : 'GET OFF'}</b>` : ''}${here?.index === i ? html`<b class="tag here">YOU'RE HERE</b>` : ''}</li>`)}</ol>
    ${here ? html`<p class="gps-note">📍 Near ${here.name} · ${here.left} stop${here.left === 1 ? '' : 's'} to ${last}</p>` : ''}
    ${ctx.ui.gps?.pos && !here ? html`<p class="gps-note">📍 You're not near this line: no stop within 1.5 km.</p>` : ''}
    ${leg.text ? html`<p class="n">${leg.text}</p>` : ''}
  </div>`;
}

export const callsAt = (stops) => html`<ol class="strip-stops calls">${stops.map((s, i) => html`<li class="${i === 0 ? 'board' : i === stops.length - 1 ? 'alight' : 'pass'}"><span>${s.time ? html`<b>${s.time}</b> ` : ''}${s.name}${s.note ? html` <em>${s.note}</em>` : ''}</span></li>`)}</ol>`;
