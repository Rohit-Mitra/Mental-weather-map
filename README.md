# Mental Health Weather Map — India

A map of India that reframes regional search-trend data as a **monsoon warning
bulletin**. Instead of rainfall and wind, it shows where people are searching
stress and anxiety terms — and colours it on the scale the India Meteorological
Department already uses: green, yellow, orange, red.

Green states are quiet. Red states are under warning, with rain falling on them
and lightning flickering behind the cloud. That is the whole idea, and it should
land in about five seconds without reading anything.

> **This is not a clinical or diagnostic tool.** It visualizes aggregated,
> anonymized public search-trend data as a general proxy signal. It contains no
> individual-level data of any kind. See [Responsible data](#responsible-data).

---

## Quick start

```bash
npm install && npm run dev
```

Then open <http://localhost:5173>.

That is the whole setup. **No API keys, no Python, no internet connection
required** — the app ships with a pre-generated dataset at
`data/trends_data.json`, the India geometry baked into the repo, and the fonts
self-hosted, so it comes up looking finished on a fresh clone.

To build a static bundle instead: `npm run build && npm run preview`.

**Requirements:** Node 18+. (Python 3.9+ only if you want to regenerate data.)

---

## What you are looking at

Every state and union territory carries a **Storm Index** from 0 to 100 — a
weighted, normalized average of regional search interest across eight tracked
phrases:

> `anxiety symptoms` · `panic attack` · `can't sleep` · `exam stress` ·
> `work stress` · `burnout` · `psychiatrist near me` · `तनाव`

The basket is built for India specifically. `exam stress` carries far more signal
here than it would elsewhere (board exams, JEE, NEET); `psychiatrist near me` is
the more common help-seeking phrasing than "therapist"; and a large share of
searching happens in Hindi, so an English-only basket would be measurably wrong.

The index drives both the colour and the animation:

| Index | Band | IMD code | What the map does |
| --- | --- | --- | --- |
| 0–20 | **Clear** | Green · no warning | Deep green, a soft sun glow |
| 21–40 | **Hazy** | Green · no warning | Thin cloud drifting slowly |
| 41–65 | **Overcast** | Yellow · watch | Denser grey cover, muted fill |
| 66–85 | **Storm** | Orange · alert | Falling rain, occasional lightning |
| 86–100 | **Cloudburst** | Red · warning | Fast rain, frequent lightning, pulsing red ring |

All 36 units are represented. The six too small to see at this scale — Delhi,
Chandigarh, Goa, Puducherry, Lakshadweep, and Dadra & Nagar Haveli and Daman &
Diu — are drawn as weather-station discs so they are visible and clickable
rather than silently absent.

### Interaction

- **Hover** any state for a quick readout.
- **Click / tap** for its full forecast: the headline number, the 12-month
  forecast history, a readings block (see below), the searches rising fastest
  there, and the per-term breakdown behind the index.
- The right column, when nothing is selected, shows **what's loudest today** and
  **the biggest movers this week** — both clickable, which is also how you find a
  state without knowing its shape.
- **Current Conditions / 12-Month Outlook** toggles between the latest week and
  the yearly average.
- **Replay** — drag the scrubber or press play to watch systems build and cross
  the country over 12 months.
- Keyboard accessible throughout (states are tabbable, Enter/Space opens a
  forecast, Escape closes). Honours `prefers-reduced-motion`.

### The readings block

A single number and a rank do not tell you much. Each state's panel also answers:

- **vs all-India** — how far above or below the national reading it sits
- **4-week change** and **run** — which way it is moving, and for how long
- **Year's peak** — its worst week in the window, and when
- **Driven by** — which tracked term is most elevated *against the same term
  elsewhere in the country*. "Exam stress is high in May" is not a finding;
  "exam stress here is 37 points above the national level for that term" is.

---

## Mock data vs. real data

This is the part that matters for a live demo, so it is deliberate.

**The app ships with synthetic data and never calls an API at runtime.** Google
Trends has no official API; `pytrends` wraps an undocumented endpoint that is
aggressively rate limited and returns 429s without warning. So the data layer is
split in two, and both halves write the **identical schema** to the **same path**.

```
data/generate_mock_data.py   → data/trends_data.json    (synthetic, ships by default)
data/fetch_trends.py         → data/trends_data.json    (real, optional, best effort)
```

### Swapping in real data

There is **no toggle to flip and no code to change** — the frontend fetches
`data/trends_data.json` at runtime, so it is a file swap:

```bash
pip install -r data/requirements.txt
python3 data/fetch_trends.py        # geo=IN, overwrites data/trends_data.json
```

Reload the page. The UI reads provenance straight out of the file: when
`meta.is_synthetic` is true it shows an amber **SIMULATED DATA** badge and a
warning at the top of the About dialog; with real data it shows a **Google
Trends** badge instead.

`fetch_trends.py` only overwrites the dataset after a successful,
schema-validated fetch — **if it fails, your working data is left untouched** and
the app keeps running.

```bash
python3 data/fetch_trends.py --history per-state --rising per-state
```

By default (~10 requests, ~2 min) it measures the national weekly series, plus
each state's 12-month and current-week regional interest, and *derives* each
state's weekly history by scaling the national shape to that state's measured
levels. `--history per-state` measures each state's history for real (~110
requests via `geo=IN-XX`, slow, rate-limit prone). Either way, the run records
what was measured and what was derived in `meta.history_mode` and `meta.notes`,
and the About dialog surfaces those notes.

### Regenerating the synthetic data

```bash
python3 data/generate_mock_data.py            # deterministic; same seed = same output
python3 data/generate_mock_data.py --seed 7   # a different week of weather
python3 data/schema.py data/trends_data.json  # validate any dataset
```

The generator is not noise. It models the shape India's year actually has:

- an annual cycle peaking across the **exam-and-heat months** and troughing after
  the monsoon — not the winter-peaking curve a temperate country would show;
- the **exam calendar**, the loudest stress signal in India: boards in February
  and March, JEE and NEET in late April and May, results through June;
- the **financial year ending 31 March**, which is appraisal and target season;
- the **monsoon's advance** — onset reaches Kerala around 1 June and the far north
  about five weeks later, so relief sweeps south to north across the map with the
  disruption of peak rain following behind it;
- the festive season, and the northern winter's cold and air-quality months;
- a damped random walk for smooth week-to-week motion, plus discrete storm events.

It is still **fabricated**, and says so everywhere it can.

---

## Project structure

```
├── data/
│   ├── schema.py              # single source of truth: schema docs, terms, bands,
│   │                          #   states, the index maths, and a validator
│   ├── generate_mock_data.py  # synthetic generator (ships by default)
│   ├── fetch_trends.py        # optional real Google Trends fetch, with backoff
│   ├── trends_data.json       # the committed dataset the app reads
│   └── requirements.txt       # pytrends + pandas (only for the optional fetch)
├── scripts/
│   ├── prepare_source_geo.mjs # network step, run once: district GeoJSON → states
│   ├── india-states.topo.json # vendored boundaries (committed, 74 KB)
│   └── build_geo.mjs          # TopoJSON → flat SVG paths (npm run build:geo)
├── src/
│   ├── App.jsx                # state, data join, three-column bulletin layout
│   ├── components/
│   │   ├── WeatherMap.jsx     # the SVG map and its weather layers
│   │   ├── MapDefs.jsx        # cloud/rain patterns, glows, gradients
│   │   ├── WarningLadder.jsx  # the left-rail gauge (legend + histogram + reading)
│   │   ├── Masthead.jsx  TodayBoard.jsx  StateDetailPanel.jsx
│   │   ├── TrendChart.jsx     # hand-rolled SVG "forecast history" chart
│   │   ├── WeatherIcon.jsx  Ticker.jsx  AboutModal.jsx  Disclaimer.jsx
│   │   └── ViewToggle.jsx  TimeScrubber.jsx  Tooltip.jsx
│   ├── lib/
│   │   ├── stormIndex.js      # bands, colour ramp, formatting
│   │   ├── narrative.js       # every sentence the user reads, generated from data
│   │   └── useTrendsData.js   # runtime fetch + bundled fallback
│   ├── data/india-states-paths.json   # precomputed geometry (committed)
│   └── styles/app.css
└── vite.config.js             # serves /data in dev, copies it into dist on build
```

The JSON schema is documented in full, with invariants, at the top of
**`data/schema.py`**. Both producers import from that module and validate their
output against it before writing, so the two datasets cannot drift apart.

---

## Design notes

The page is built as a **bulletin**, not a dashboard.

- **Colour is spent in exactly one place.** The IMD warning ladder shades the map
  and the gauge; every other surface is monochrome warm charcoal and bulletin
  bone. The only coloured thing on screen is the thing that carries meaning.
- **The left rail is one instrument, not three panels.** The warning ladder is
  the legend, a histogram of how many states sit in each band, and a gauge with
  the all-India reading pinned at its true height. Band heights are proportional
  to their share of the 0–100 scale, so it is a real scale rather than five equal
  swatches.
- **Type.** Display is [Anek Latin](https://fonts.google.com/specimen/Anek+Latin)
  by Ek Type, an Indian foundry, set on its width axis; body is IBM Plex Sans;
  anything an instrument would print — index values, timestamps, bulletin numbers
  — is IBM Plex Mono; Hindi is Anek Devanagari. All self-hosted via Fontsource.
- **Structural devices encode something true.** The bulletin number really is
  which weekly reading of its year you are looking at, and it changes when you
  scrub the replay.

### How it is built

- **No geo libraries in the browser.** `scripts/build_geo.mjs` projects the
  vendored TopoJSON once at build time into flat SVG path strings. The runtime
  bundle carries no `d3-geo` and no `topojson-client`.
- **Weather is painted with shared SVG patterns, not particles.** A state's rain
  is just `fill="url(#rain-storm)"` on a copy of its own path — which clips the
  effect to the state border for free and lets all 36 states animate off a
  handful of keyframe timelines. Patterns are laid out in three tile-offset
  copies and animated exactly one tile, so the loops are seamless.
- **Borders come from a shared mesh**, so every boundary is stroked exactly once
  and no state's cloud cover swallows its neighbour's outline.
- **No chart library.** The forecast history is ~130 lines of hand-rolled SVG.
- Runtime dependencies are React and React DOM. Nothing else.

### Boundaries

State boundaries are derived from a district-level GeoJSON of India and dissolved
to the 36 states and union territories, including Jammu & Kashmir, Ladakh,
Arunachal Pradesh and the island territories, as conventionally depicted within
India. Regenerate with `npm run geo:source && npm run build:geo` (the first step
is the only one that needs the network, and its output is committed).

---

## Responsible data

This project puts monsoon-warning imagery on a sensitive topic, so the following
are built in rather than bolted on:

- **A persistent disclaimer** in the footer, on screen at all times — not hidden
  behind a button — stating that this is aggregated proxy data, not a clinical or
  diagnostic tool, and pointing to professional help.
- **An "About the data" dialog** explaining in plain language what search-trend
  data is (relative interest, not counts of people), why it is a noisy proxy and
  not a diagnosis, exactly how the Storm Index is computed, and citing
  [Google Trends](https://trends.google.com/trends/) as the source.
- **What it under-represents, stated plainly.** Internet and smartphone access is
  uneven across Indian states and skews urban, younger and male; people search in
  many languages and in Hinglish. States where fewer people search at all will
  look calmer regardless of what is happening. The About dialog says to read a
  green state as *"we have little signal"*, not as *"all is well"*.
- **No individual-level data anywhere, by construction.** Google Trends only ever
  publishes anonymized, aggregated, normalized figures. The smallest unit in this
  app is a whole state or union territory.
- **Honest provenance in the UI.** Synthetic data is labelled as synthetic
  everywhere it appears, and the About dialog carries whatever caveats the
  dataset itself declares — including, for real fetches, which numbers were
  measured and which were derived.
- **Helplines** in the About dialog and the footer: **Tele-MANAS 14416**
  (Government of India, free, 24×7), KIRAN 1800-599-0019, Vandrevala Foundation
  9999 666 555, iCall 9152987821, and findahelpline.com internationally.

Language throughout is deliberately about *searching*, never about people being
anxious. A storm on this map means more searching, which may or may not track
more distress.

---

## Stretch goals

| Goal | Status |
| --- | --- |
| Time-scrub slider to replay 12 months | **Done** — drag or press play |
| Overview board (loudest today, biggest movers) | **Done** — fills the right column |
| Ambient rain/wind sound on hover | Not implemented |
| "Download this forecast" PNG export | Not implemented |
| Two-state comparison view | Not implemented |

PNG export in particular is not a small job here: the map's look depends on an
external stylesheet and running CSS animations, so a faithful export needs
computed styles inlined into a serialized SVG rather than a quick canvas dump.

---

## Licence / attribution

Search-interest data from [Google Trends](https://trends.google.com/trends/).
State boundaries derived from
[udit-001/india-maps-data](https://github.com/udit-001/india-maps-data).
Type: [Anek](https://fonts.google.com/specimen/Anek+Latin) by Ek Type and
[IBM Plex](https://www.ibm.com/plex/), both open licensed.
