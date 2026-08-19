/**
 * The Storm Index: a 0-100 number and the weather metaphor built on top of it.
 *
 * The five bands are colour-coded to the India Meteorological Department's
 * warning ladder — Green (no warning), Yellow (watch), Orange (alert), Red
 * (warning) — because that is the vocabulary an Indian audience already reads
 * fluently off a monsoon bulletin. Green covers the two calm bands, which keeps
 * the median state at "watch" rather than overstating it as an alert.
 *
 * Band boundaries are mirrored in data/schema.py — change them in both places.
 * Everything visual (fill colour, which animations run, which icon shows) keys
 * off this module so the metaphor stays consistent across map, ladder, panel,
 * tooltip and ticker.
 */

export const TIERS = [
  {
    key: 'clear',
    label: 'Clear',
    code: 'Green',
    level: 'No warning',
    min: 0,
    max: 20,
    blurb: 'Barely any stress-related searching',
  },
  {
    key: 'hazy',
    label: 'Hazy',
    code: 'Green',
    level: 'No warning',
    min: 21,
    max: 40,
    blurb: 'A little more searching than usual',
  },
  {
    key: 'overcast',
    label: 'Overcast',
    code: 'Yellow',
    level: 'Watch',
    min: 41,
    max: 65,
    blurb: 'Noticeably elevated — worth watching',
  },
  {
    key: 'storm',
    label: 'Storm',
    code: 'Orange',
    level: 'Alert',
    min: 66,
    max: 85,
    blurb: 'A sharp rise — a stress system is sitting over this state',
  },
  {
    key: 'cloudburst',
    label: 'Cloudburst',
    code: 'Red',
    level: 'Warning',
    min: 86,
    max: 100,
    blurb: 'Among the highest search interest on the map',
  },
];

export const STORM_WATCH_THRESHOLD = 66;

export function tierFor(index) {
  const v = clamp(index);
  return TIERS.find((t) => v <= t.max) ?? TIERS[TIERS.length - 1];
}

export function clamp(v, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, v ?? 0));
}

/**
 * Continuous colour ramp along the warning ladder.
 *
 * Shading is continuous rather than five flat bands so neighbouring states stay
 * distinguishable inside a band; the discrete bands drive the animation layers
 * instead. Brightness rises with the index, so the states that need attention
 * advance off the dark ground and the calm ones recede.
 */
const RAMP = [
  [0, [18, 105, 74]], //    0  deep monsoon green
  [20, [30, 138, 80]], //  20  green
  [40, [122, 160, 45]], // 40  green shading to yellow
  [55, [214, 163, 32]], // 55  IMD yellow — watch
  [70, [227, 118, 44]], // 70  IMD orange — alert
  [85, [211, 53, 50]], //  85  IMD red — warning
  [100, [244, 74, 58]], //100  hot red
];

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function colorFor(index) {
  const v = clamp(index);
  for (let i = 1; i < RAMP.length; i += 1) {
    const [hiStop, hiRGB] = RAMP[i];
    if (v <= hiStop) {
      const [loStop, loRGB] = RAMP[i - 1];
      const t = (v - loStop) / (hiStop - loStop || 1);
      const rgb = hiRGB.map((c, k) => Math.round(lerp(loRGB[k], c, t)));
      return `rgb(${rgb.join(',')})`;
    }
  }
  return `rgb(${RAMP[RAMP.length - 1][1].join(',')})`;
}

/** Accent used for text and rules that must stay legible on the dark ground. */
export const TIER_ACCENT = {
  clear: '#35b77e',
  hazy: '#8fc44e',
  overcast: '#e8b93a',
  storm: '#f08a45',
  cloudburst: '#ff6b52',
};

/** Reads a state's index for the current view mode / replay week. */
export function indexForView(state, viewMode, weekIndex) {
  if (viewMode === 'outlook') return state.outlook.storm_index;
  const point = state.history[weekIndex];
  return point ? point.storm_index : state.current.storm_index;
}

/** "16 Aug 2026" — Indian date order, from an ISO week-start string. */
export function formatWeek(iso, opts = {}) {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-IN', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    ...(opts.year === false ? {} : { year: 'numeric' }),
  });
}

export function formatMonth(iso) {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-IN', { timeZone: 'UTC', month: 'short' });
}

/**
 * Bulletin number: which weekly bulletin of its year this reading is.
 * Structural, not decorative — it is genuinely the Nth week of that year.
 */
export function bulletinNumber(iso) {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.floor((d.getTime() - start) / (7 * 24 * 3600 * 1000)) + 1;
  return { week, year: d.getUTCFullYear() };
}
