// What a visitor sees first: what Fieldbook is, the demo, and a way in for a trip link.
import { html } from '../html.js';

export const landingView = () => html`<section class="landing">
  <h1>Fieldbook</h1>
  <p class="lead">An offline trip companion. Fieldbook turns an itinerary file into a phone app: what's next, how to get there, where to eat and a pocket guide to each place, all working without signal.</p>
  <a class="btn p big" href="#demo">Try the demo</a>
  <form class="open" data-form="open-trip">
    <label for="link">Have a trip link? Paste it here</label>
    <input id="link" name="link" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="https://…#open=…">
    <button class="btn" type="submit">Open the trip</button>
  </form>
  <p class="fine">Trips are encrypted on the owner's own computer before they're uploaded, so this site only ever holds scrambled data. <a href="https://github.com/arash009/fieldbook">Source on GitHub</a>.</p>
</section>`;

export const messageView = (title, text) => html`<section class="landing"><h1>${title}</h1><p class="lead">${text}</p><a class="btn" href="./">Back to the start</a></section>`;
