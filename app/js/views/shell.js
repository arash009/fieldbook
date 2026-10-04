// Picks the screen for the current route and draws the bottom navigation.
import { html, raw } from '../html.js';
import { todayView, dayView } from './day.js';
import { daysView } from './days.js';
import { stopView } from './stop.js';
import { bookingsView } from './bookings.js';
import { guideListView, guideView } from './guide.js';
import { infoView, infoCardView } from './info.js';
import { askSheet } from './ask.js';

const VIEWS = { today: todayView, day: dayView, days: daysView, stop: stopView, bookings: bookingsView, guide: guideListView, guideItem: guideView, info: infoView, infoCard: infoCardView };
const TABS = [['today', 'Today', '●'], ['days', 'Days', '▤'], ['bookings', 'Book', '✓'], ['guide', 'Guide', '✦'], ['info', 'Info', 'ⓘ']];
const TAB_OF = { day: 'days', stop: 'days', guideItem: 'guide', infoCard: 'info' };

export const driverOverlay = (text) => html`<div class="driver" role="dialog" aria-modal="true" aria-label="Address for the driver"><p class="big">${text}</p><button class="btn p big" type="button" data-action="driver-close">Close</button></div>`;

export function renderApp(ctx) {
  const view = VIEWS[ctx.route.name] ?? todayView;
  const active = TAB_OF[ctx.route.name] ?? ctx.route.name;
  return {
    main: html`${ctx.mode === 'demo' ? html`<div class="ribbon">Sample trip · <button type="button" class="link" data-action="leave-demo">Leave the demo</button></div>` : ''}${view(ctx)}${ctx.ui.ask ? askSheet(ctx) : ''}${ctx.ui.driver ? driverOverlay(ctx.ui.driver) : ''}`,
    nav: html`${TABS.map(([id, label, icon]) => html`<a href="#/${id}" class="${id === active ? 'on' : ''}"${id === active ? raw(' aria-current="page"') : ''}><b aria-hidden="true">${icon}</b>${label}</a>`)}`,
  };
}
