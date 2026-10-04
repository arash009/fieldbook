# Architecture

## Shape

```
itinerary folder ──fieldbook encrypt──► trips/<id>.enc ─┐
                                                        ├─► static site (GitHub Pages) ──► phone (installed web app)
app/ ──fieldbook build──► index.html, app.js, sw.js ───┘
```

- **No framework, no dependencies.** The app is plain ES modules in `app/js/`. A small bundler (`scripts/lib/bundle.mjs`) wraps each module in a function and wires imports, giving one `app.js` that works from a server or inlined in a single HTML file.
- **Pure logic, tested in Node.** `clock.js` (time in the trip's zone), `plan.js` (next stop, leaving-now, bookings, boards, the Ask context), `data.js`, `html.js`, `router.js`, `ticks.js` and `crypto.js` have no DOM dependencies. `node --test` runs them and renders every view against the demo.
- **Views are functions that return HTML.** Every interpolated value goes through the `html` tagged template, which escapes it. Data can't inject markup, and the Content Security Policy blocks inline scripts on the hosted site.
- **One state object, re-rendered.** `main.js` keeps the decrypted trip, the ticks and small UI state. It re-renders on navigation, on taps and every 30 seconds, so "next" and "leaving now?" stay current.

## Offline
- The service worker caches the app shell per build version.
- Trip files are network-first, so an update arrives as soon as there's signal, with the cached copy used otherwise.
- After one visit with signal, everything works in airplane mode except map links, outside links and Ask Claude.
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

**The single-file backup** (`encrypt --single-file`) is the same app and the same ciphertext in one HTML file. It's for keeping on the phone in case the site can't be reached. It has no service worker, and it asks for the passphrase again if the browser blocks storage for local files.

## Keeping a real trip out of a public repo
The intended setup keeps each real itinerary in its own private folder or repository and runs the CLI from there. The owner of this repo also runs a local pre-push check that scans this repository, its history and the built site against terms taken from their private itinerary, so nothing from a real trip can be pushed here by mistake.
