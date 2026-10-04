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

### `dining`
One entry per planned meal: `date`, `meal` (`breakfast`, `lunch`, `dinner`), `place`, `city`, `address`, `badge` (a short tag shown in lists, e.g. `Vegetarian menu`), `tags` (several tags instead of one badge), `setup`, `hoursThatDay`, `closed`, `book` (true/false), `maps`, `source`.

`diningExtras` lists treats and backups: `kind` (used as a heading), `place`, `city`, `where`, `note`. Extras in the same city appear under each meal card.

### `stays`
`id`, `city`, `area`, `checkIn`, `checkOut`, `nights`, and optionally `checkInFrom`, `checkOutBy`, `checkInMethod`, `sleeps`, `amenities`, `maps`, `notes`. Keep exact addresses in `private/stays.json`, keyed by the same `id`.

### `bookings`
`id`, `item`, `forDate`, `deadline` (or `null`), `status`, `url`, `notes`. Status is one of `booked`, `todo`, `unconfirmed`, `unknown`, `optional`, `on-the-day`. The list is sorted by deadline, else by the date the booking is for. Ticking a booking on the phone counts it as done.

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

## `data/transport.json`
| Part | Shape |
|---|---|
| `lines` | `{ <id>: { label, name, colour } }`. Labels appear on coloured chips. |
| `services` | `{ <id>: { hours: [{ days: [0–6], from, to }], hoursText, frequency, sources } }`. Days count from 0 = Sunday. A `to` earlier than `from` runs past midnight, so Friday `05:30–01:30` covers early Saturday too. |
| `routes` | `{ <id>: { options: [option, …] } }`. The first option is the plan. |
| `boards` | `{ <id>: { title, date, tabs: [{ label, stations: [...], plan, note, rows: [{ times: [...], flag, note }] }], notes, checked, sources } }`. One time per station (`null` if the train doesn't call); `plan` is the planned departure from the first station. |

A route option: `mode` (`metro`, `tram`, `train`, `bus`, `ferry`, `taxi`, `walk`), `label`, `minutes: [min, max]` door to door, `service`, `legs`, `later` (latest time to leave, as text), `fare`, `fareShort` (for chips), `pay`, `access`, `notes`, `where`, `driverText` (shown large for a taxi driver), `checked`, `sources`.

A leg is either a ride, `{ line, direction, stops, to, text }`, or a walk, `{ walk: metres, minutes, text }`.

"Leaving now?" adds each option's `minutes` to the current time and flags it when the latest arrival misses the next stop. When the option has a `service` that isn't running, it says so.

## `private/`
`stays.json` is keyed by stay id: `address`, `addressNote`, `host`, `registrationCode`, `listingUrl`, `listingTitle`. `config.json` holds `tripId` (4–32 lowercase letters or digits, used in the file name), `claudeProjectUrl` (the link Ask Claude opens) and `prefillParam` (a query parameter to pre-fill the question, or `null`).

These files go into the encrypted trip file like everything else. Keeping them separate means they never need to be in a shared repository.
