# Itinerary format (`fieldbook/1`)

Fieldbook reads a trip from a folder. Everything the app shows comes from these files; the app itself knows only concepts such as stop types, transport modes and booking statuses. The [Lisbon demo](../demo) uses every feature and is the best example to copy.

```
my-trip/
  data/trip.json        the plan (required)
  data/guides.json      the pocket guide (optional)
  data/transport.json   routes, lines, running hours, departure boards (optional)
  private/stays.json    addresses and other details to keep out of anything public (optional)
  private/config.json   trip id and the Ask Claude link (optional)
```

`fieldbook validate --trip my-trip` checks the folder and explains every problem in plain English. `fieldbook encrypt` refuses to encrypt an invalid trip.

Conventions: dates are `YYYY-MM-DD`, times are `HH:MM` (24-hour) in the trip's own time zone, colours are `#rrggbb`, links must be `https://`.

## `data/trip.json`

### `meta` (required)
| Field | Meaning |
|---|---|
| `title` | Shown before the trip starts. |
| `startDate`, `endDate` | First and last day. |
| `timezone` | IANA zone, e.g. `Europe/Lisbon`. "Today" and "next" use this zone whatever the phone is set to. |
| `factsCheckedBetween` | `[from, to]` dates (or text) shown as "checked …" labels. |
| `pace` | One line about the pace of the trip, shown in the pace box. |

### `travellers`
`mobility` and `dietary` are lists of sentences, shown in the pace box on each day (until dismissed) and on Info.

### `days` (required)
Each day: `date`, `city`, `title`, `stops`. Days must be in date order inside the trip dates.

Each stop:

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | Unique, `a-z 0-9 -`. Ticks on the phone are stored against it. |
| `time` | yes | `HH:MM`. Used for ordering and "next". |
| `timeLabel` | | Text to show instead of the time, e.g. `After lunch`. |
| `title` | yes | |
| `type` | yes | `transport`, `sight`, `meal`, `rest` or `logistics`. Sets the colour tile. |
| `notes` | | Shown in full on the stop, first sentence in lists. |
| `maps` | | A Google Maps search text, or `null`. |
| `optional` | | `true` marks a stop the group may skip. |
| `route` | | Id in `transport.routes`: shows options, "leaving now?" and later times. |
| `board` | | Id in `transport.boards`: shows a departure board. `boardTab` picks the tab. |
| `dining` | | `date/meal` key of an entry in `dining`: shows the meal card. |
| `guide` | | Id (or list of ids) in `guides`. |
| `stay` | | Id in `stays`: shows the stay card with address and "Show the driver". |
| `entry` | | "Getting in" for a stop with no guide. Same shape as a guide's `entry` (below). A sight stop shows the badge from its own `entry`, else from its first guide that has one. |

### `dining`
One entry per planned meal: `date`, `meal` (`breakfast`, `lunch`, `dinner`), `place`, `city`, `address`, `badge` (a short tag shown in lists, e.g. `Vegetarian menu`), `tags` (several tags instead of one badge), `setup`, `hoursThatDay`, `closed`, `book` (true/false), `maps`, `source`.

`diningExtras` lists treats and backups: `kind` (used as a heading), `place`, `city`, `where`, `note`. Extras in the same city appear under each meal card.

### `stays`
`id`, `city`, `area`, `checkIn`, `checkOut`, `nights`, and optionally `checkInFrom`, `checkOutBy`, `checkInMethod`, `sleeps`, `amenities`, `maps`, `notes`. Keep exact addresses in `private/stays.json`, keyed by the same `id`.

### `bookings`
`id`, `item`, `forDate`, `deadline` (or `null`), `status`, `url`, `notes`. Status is one of `booked`, `todo`, `unconfirmed`, `unknown`, `optional`, `on-the-day`. The list is sorted by deadline, else by the date the booking is for. Ticking a booking on the phone counts it as done. They appear on the Tickets tab under "To book", with a **Buy ›** button for each open booking that has a `url`.

### `cities`
`{ <city>: { lat, lng } }`, keyed by the names used in each day's `city`. Each day then shows a forecast from Open-Meteo (icon, high and low, chance of rain, sunset) once the day is within 16 days. Without coordinates, or without signal, the day shows no forecast.

### `alerts`
`date`, `title`, `text`, `checked`, `sources`. Shown at the top of Today and Days until the day has passed, and tagged on that day.

### Reference sections
`localTransport` (per city: `summary`, `stops`, `routes`, `frequency`, `hours`, `fare`, `howToPay`, `accessibility`, `taxiFallback`, `notes`, `sources`), `transfers` (`id`, `title`, `summary`, `recommended`, `options[]`, `ticketNotes`), `flights` (`segments[]`, `status`, `baggage`), `tips` (`topic`, `text`, `source`) and `links` (`label`, `url`). They appear on the Info cards.

### `ui`
| Field | Meaning |
|---|---|
| `infoCards` | `[{ id, title, subtitle, icon, colour, sections }]`. Each section is one of `transfer:<id>`, `transfers`, `localTransport:<city>`, `dining`, `diningExtras`, `boards`, `tips`, `stays`, `flights`, `links`, `travellers`. Without this, Fieldbook makes sensible cards itself. |
| `dietPhrase` | `{ say, meaning }`: a phrase shown large on every meal card. |
| `askChips` | Quick questions offered in the Ask Claude sheet. |

## `data/guides.json`
```json
{ "guides": [ { "id": "castle", "kind": "sight", "title": "São Jorge Castle", "city": "Lisbon",
  "why": "Two sentences on why it matters.",
  "lookFor": ["Things to point out on the spot"], "facts": ["One-sentence facts"],
  "kids": [{ "q": "A question for children", "a": "Its answer" }],
  "sources": ["https://…"], "checked": "2030-05-01" } ] }
```
`kind: "city"` entries are listed first as city intros. Places are listed in the order the trip first visits them.

Optional fields on a guide:

| Field | Shape and meaning |
|---|---|
| `entry` | "Getting in": `{ booking, summary, buyUrl, prices, hours, allow, rules, dress, access, bookingId, sources, checked }`. `booking` is `required` (badge PRE-BOOK), `recommended` (BOOK AHEAD), `at-door` (AT THE DOOR) or `free` (FREE). `bookingId` links to `trip.bookings[].id`: once that booking is `booked` or ticked, the badge reads BOOKED ✓. `buyUrl` must be the official seller, over `https://`. |
| `images` | `{ hero: { src, page, alt, credit, licence }, lookFor: [{ index, src, page, alt, credit, licence }] }`. Wikimedia Commons thumbnails (`upload.wikimedia.org`, 960px for the hero, 500px for look-for items); `page` is the Commons file page, and the credit line links to it. `index` points at the `lookFor` item the photo goes with. |
| `links` | `[{ label, url }]`, shown under "Read more": Wikipedia, the official site, one good explainer. |
| `video` | `{ label, url, minutes }`, a short film shown in "Read more". |

The guide page also has a **Listen** button that reads it aloud with the phone's own voice, when the browser supports speech.

## `data/transport.json`
| Part | Shape |
|---|---|
| `lines` | `{ <id>: { label, name, colour, stops, directions, mapUrl, notes } }`. Labels appear on coloured chips. `stops` is `[{ name, lat, lng, aliases? }]` in line order: with it, each ride on the line is drawn as a strip of every stop from boarding to getting off. `directions` (`{ <terminus>: [stop names] }`) gives the order for lines whose two directions differ, such as one-way loops. `mapUrl` links to the official map. |
| `liveStatus` | `{ <operator>: "…{number}…" }`, a URL pattern per train operator. Each board row with a `train` and that `operator` gets a **Live ›** link with the train number filled in. |
| `services` | `{ <id>: { hours: [{ days: [0–6], from, to }], hoursText, frequency, sources } }`. Days count from 0 = Sunday. A `to` earlier than `from` runs past midnight, so Friday `05:30–01:30` covers early Saturday too. |
| `routes` | `{ <id>: { options: [option, …] } }`. The first option is the plan. |
| `boards` | `{ <id>: { title, date, tabs: [{ label, stations: [...], plan, note, rows: [{ times: [...], flag, note }] }], notes, checked, sources } }`. One time per station (`null` if the train doesn't call); `plan` is the planned departure from the first station. A row can add `train` (e.g. `CP 1502`), `operator` (a key of `liveStatus`) and `stops: [{ name, time, note }]`, shown as "Calls at" for the planned train. A board's `buyUrl` gives a **Buy ticket ›** button. |

A route option: `mode` (`metro`, `tram`, `train`, `bus`, `ferry`, `taxi`, `walk`), `label`, `minutes: [min, max]` door to door, `service`, `legs`, `later` (latest time to leave, as text), `fare`, `fareShort` (for chips), `pay`, `access`, `notes`, `where`, `driverText` (shown large for a taxi driver), `checked`, `sources`.

A leg is either a ride, `{ line, from, direction, stops, to, text }`, or a walk, `{ walk: metres, minutes, text }`. A ride with `from` on a line with `stops` is drawn as a strip, with a **Where am I?** switch that marks the nearest stop (within 1.5 km) and counts the stops left. `fieldbook validate` reports a ride it can't place on its line; the app then shows the ride as text.

"Leaving now?" adds each option's `minutes` to the current time and flags it when the latest arrival misses the next stop. When the option has a `service` that isn't running, it says so.

## `private/`
`stays.json` is keyed by stay id: `address`, `addressNote`, `host`, `registrationCode`, `listingUrl`, `listingTitle`. `config.json` holds `tripId` (4–32 lowercase letters or digits, used in the file name), `claudeProjectUrl` (the link Ask Claude opens) and `prefillParam` (a query parameter to pre-fill the question, or `null`).

`tickets.json` lists ticket files kept in `private/tickets/`: `[{ id, label, date, file, booking?, stop?, notes? }]`. `file` is a PDF, PNG or JPG in that folder; `booking` (a booking id) or `stop` (a stop id) puts a **My ticket** button on the matching "Getting in" card. `fieldbook encrypt` encrypts each file separately with the trip key, under a random name, and stops if a listed file is missing. The Tickets tab lists them, today's first.

These files go into the encrypted trip file like everything else. Keeping them separate means they never need to be in a shared repository.
