# Architecture

## Shape

```
itinerary folder ──fieldbook encrypt──► trips/<id>.enc ─┐
                                                        ├─► static site (GitHub Pages) ──► phone (installed web app)
app/ ──fieldbook build──► index.html, app.js, sw.js ───┘
```

- **No framework, no dependencies.** The app is plain ES modules in `app/js/`. A small bundler (`scripts/lib/bundle.mjs`) wraps each module in a function and wires imports, giving one `app.js` that works from a server or inlined in a single HTML file.
- **Pure logic, tested in Node.** `clock.js` (time in the trip's zone), `plan.js` (next stop, leaving-now, bookings, boards, getting-in badges, live-status links, the Ask context), `lines.js` (which stops a ride passes, and the nearest stop to a GPS position), `weather.js` (the forecast request and its mapping), `speech.js` (a guide as short sentences for speech), `data.js`, `html.js`, `router.js`, `ticks.js` and `crypto.js` have no DOM dependencies. `node --test` runs them and renders every view against the demo.
- **Views are functions that return HTML.** Every interpolated value goes through the `html` tagged template, which escapes it. Data can't inject markup, and the Content Security Policy blocks inline scripts on the hosted site.
- **One state object, re-rendered.** `main.js` keeps the decrypted trip, the ticks and small UI state. It re-renders on navigation, on taps and every 30 seconds, so "next" and "leaving now?" stay current.

## Offline
- The service worker caches the app shell per build version.
- Trip files are network-first, so an update arrives as soon as there's signal, with the cached copy used otherwise.
- Guide photos are cached after first view (cache-first, the newest 150 kept). Encrypted ticket files are cached like trip files once opened.
- After one visit with signal, everything works in airplane mode except map links, outside links, Ask Claude, the forecast, photos not yet seen and the PDF viewer the first time it's needed.
- Ticks (stops done, bookings made) are stored in `localStorage` per trip and survive updates, because they're keyed by stable ids.

## Encryption and threat model

**What's public:** the app code, the demo, and for each trip one JSON file containing a salt, an IV and AES-GCM ciphertext. Anyone can see that a trip file exists, its random id and its size.

**What isn't:** everything in the trip. It's encrypted on the owner's computer before upload:
- **Key:** PBKDF2-SHA-256 with 600,000 iterations over a passphrase, then AES-256-GCM, which also detects tampering.
- **Passphrase:** the CLI refuses fewer than 5 words or 24 characters, because the ciphertext can be attacked offline by anyone who downloads it. A long random passphrase is what makes that impractical.
- **Salt:** stable per trip, kept beside the itinerary. Each update gets a fresh IV, and a key saved on the phone keeps working across updates.
- **On the phone:** the key is derived once and stored in IndexedDB as a non-extractable `CryptoKey`, so scripts can use it but not read it out. The decrypted trip lives only in memory. Lock deletes the key.

**What Fieldbook does not protect against:**
- someone using the unlocked phone;
- a weak passphrase;
- anything the owner sends elsewhere, such as the context copied into Claude by Ask Claude.

**Tickets:** each file in `private/tickets/` is encrypted separately with the same key, into `trips/<id>/<random>.enc`, so the main trip file stays small and the file names say nothing. The app fetches a ticket only when it's opened and decrypts it in memory. Images are shown directly; PDFs are drawn to canvases by PDF.js. Decrypted bytes are never written to storage. **Open in phone viewer** hands the file to the phone's own viewer after a warning, because that viewer may save a copy.

**Third-party requests:** the hosted app talks to three outside services, and nothing from the trip file is sent to any of them:
- `upload.wikimedia.org` for guide photos;
- `api.open-meteo.com` for the forecast (only the city's coordinates and the dates);
- `cdnjs.cloudflare.com` for PDF.js 3.11.174, loaded only when a PDF ticket is opened and checked against its published integrity hash.

Each request shows the phone's IP address to that service, and which places or cities are being looked at. The Content Security Policy allows those hosts and nothing else (for cdnjs, only the PDF.js path).

**The single-file backup** (`encrypt --single-file`) is the same app and the same ciphertext in one HTML file. It's for keeping on the phone in case the site can't be reached. It has no service worker, and it asks for the passphrase again if the browser blocks storage for local files. It carries no ticket files: tickets open only in the hosted app.

## Keeping a real trip out of a public repo
The intended setup keeps each real itinerary in its own private folder or repository and runs the CLI from there. The owner of this repo also runs a local pre-push check that scans this repository, its history and the built site against terms taken from their private itinerary, so nothing from a real trip can be pushed here by mistake.
