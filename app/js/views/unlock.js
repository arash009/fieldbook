// The passphrase screen for an encrypted trip.
import { html, raw } from '../html.js';

export const unlockView = ({ error, busy } = {}) => html`<section class="unlock">
  <h1>Fieldbook</h1>
  <form data-form="unlock">
    <label for="pass">Passphrase</label>
    <input id="pass" name="pass" type="password" autocomplete="current-password" autocapitalize="none" spellcheck="false" required ${busy ? raw('disabled') : ''}>
    ${error ? html`<p class="err" role="alert">${error}</p>` : ''}
    <button class="btn p big" type="submit" ${busy ? raw('disabled') : ''}>${busy ? 'Unlocking…' : 'Unlock'}</button>
  </form>
</section>`;
