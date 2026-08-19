/**
 * Turns the dataset into plain English, in the register of a weather bulletin.
 *
 * Everything a viewer reads — the masthead line, the ticker, the readings in the
 * detail panel — is generated here from the data rather than hardcoded, so it
 * stays true when the dataset is swapped.
 *
 * Language rule: this is always about *searching*, never about people being
 * anxious. A storm here means more searching, which may or may not track more
 * distress, and the copy never quietly slides from one to the other.
 */

import { STORM_WATCH_THRESHOLD, formatWeek, indexForView, tierFor } from './stormIndex.js';

/** Index at `weekIndex`, plus the week-over-week change at that point. */
export function readingAt(state, viewMode, weekIndex) {
  if (viewMode === 'outlook') {
    return { index: state.outlook.storm_index, delta: 0 };
  }
  const here = state.history[weekIndex]?.storm_index ?? state.current.storm_index;
  const prev = state.history[weekIndex - 1]?.storm_index ?? here;
  return { index: here, delta: here - prev };
}

export function nationalAt(data, viewMode, weekIndex) {
  if (viewMode === 'outlook') return data.national.outlook.storm_index;
  return data.national.history[weekIndex]?.storm_index ?? data.national.current.storm_index;
}

function plural(n, one, many) {
  return n === 1 ? one : many;
}

/**
 * The masthead line — the one sentence that has to land in five seconds.
 * Counts warnings and alerts separately, the way a real bulletin does: two
 * numbers say more than one total, and neither overstates the other.
 */
export function headline(data, viewMode, weekIndex) {
  const readings = data.states.map((s) => readingAt(s, viewMode, weekIndex).index);
  const warnings = readings.filter((v) => v >= 86).length;
  const alerts = readings.filter((v) => v >= STORM_WATCH_THRESHOLD && v < 86).length;
  const total = data.states.length;

  if (viewMode === 'outlook') {
    const above = readings.filter((v) => v >= STORM_WATCH_THRESHOLD).length;
    return above > 0
      ? `Over the last 12 months, ${above} of ${total} ${plural(above, 'state averaged', 'states averaged')} alert conditions`
      : `Over the last 12 months, no state averaged alert conditions`;
  }
  if (warnings > 0) {
    return `${warnings} ${plural(warnings, 'warning', 'warnings')} and ${alerts} ${plural(alerts, 'alert', 'alerts')} in force across India`;
  }
  if (alerts > 0) {
    return `${alerts} ${plural(alerts, 'alert', 'alerts')} in force — no warnings`;
  }
  return 'No alerts in force — settled conditions nationwide';
}

/**
 * The crawl along the bottom, ordered most urgent first, then softened with
 * easing and calm items so the bar does not read as pure alarm.
 */
export function buildTicker(data, viewMode, weekIndex) {
  const rows = data.states
    .map((s) => ({ state: s, ...readingAt(s, viewMode, weekIndex) }))
    .sort((a, b) => b.index - a.index);

  const items = [];
  const used = new Set();
  const take = (row, tone, text) => {
    if (!row || used.has(row.state.code)) return;
    used.add(row.state.code);
    items.push({ id: `${tone}-${row.state.code}`, tone, text });
  };

  rows.filter((r) => r.index >= 86).slice(0, 4).forEach((r) => {
    take(r, 'cloudburst', `Red warning — ${r.state.name}, index ${r.index}`);
  });

  rows.filter((r) => r.index >= STORM_WATCH_THRESHOLD && r.index < 86).slice(0, 4).forEach((r) => {
    if (viewMode === 'outlook') {
      take(r, 'storm', `${r.state.name} averaged alert conditions this year — index ${r.index}`);
      return;
    }
    const crossed = r.delta > 0 && r.index - r.delta < STORM_WATCH_THRESHOLD;
    take(
      r,
      'storm',
      crossed
        ? `Orange alert issued for ${r.state.name}`
        : `Orange alert continues over ${r.state.name} — index ${r.index}`,
    );
  });

  rows.slice().sort((a, b) => b.delta - a.delta).slice(0, 3)
    .filter((r) => r.delta >= 4)
    .forEach((r) => take(r, 'rising', `Pressure building over ${r.state.name}, up ${r.delta} this week`));

  rows.slice().sort((a, b) => a.delta - b.delta).slice(0, 3)
    .filter((r) => r.delta <= -4)
    .forEach((r) => take(r, 'easing', `Easing over ${r.state.name}, down ${Math.abs(r.delta)}`));

  rows.slice().reverse().slice(0, 3).forEach((r) =>
    take(
      r,
      'clear',
      r.index <= 20
        ? `Clear over ${r.state.name}`
        : `Calmest on the map: ${r.state.name}, index ${r.index}`,
    ),
  );

  const week = data.states[0]?.history[weekIndex]?.week;
  items.push({
    id: 'national',
    tone: 'info',
    text:
      viewMode === 'outlook'
        ? `National 12-month average: ${data.national.outlook.storm_index}`
        : `All-India index ${nationalAt(data, viewMode, weekIndex)} for the week of ${formatWeek(week)}`,
  });

  return items;
}

/** Ranks a state nationally, e.g. "3rd highest of 36". */
export function nationalRank(data, code, viewMode, weekIndex) {
  const sorted = data.states
    .map((s) => ({ code: s.code, index: indexForView(s, viewMode, weekIndex) }))
    .sort((a, b) => b.index - a.index);
  return { rank: sorted.findIndex((r) => r.code === code) + 1, total: sorted.length };
}

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Mean score per tracked term across all states, for the current week.
 * Used to work out which term is unusually elevated in a given state rather
 * than merely large — "exam stress is high everywhere in May" is not a finding.
 */
export function termMeans(data) {
  const means = {};
  data.meta.terms.forEach((term) => {
    const total = data.states.reduce((sum, s) => sum + (s.current.term_scores?.[term] ?? 0), 0);
    means[term] = total / Math.max(data.states.length, 1);
  });
  return means;
}

/** How many consecutive weeks the index has moved the same way, ending here. */
function streakAt(state, weekIndex) {
  const h = state.history;
  if (weekIndex < 1) return null;
  const dir = Math.sign(h[weekIndex].storm_index - h[weekIndex - 1].storm_index);
  if (dir === 0) return null;
  let weeks = 0;
  for (let i = weekIndex; i >= 1; i -= 1) {
    if (Math.sign(h[i].storm_index - h[i - 1].storm_index) !== dir) break;
    weeks += 1;
  }
  return { weeks, direction: dir > 0 ? 'rising' : 'easing' };
}

/**
 * The readings that make the panel worth opening: not just how high this state
 * is, but whether that is unusual for it, which way it is moving, how it sits
 * against the rest of the country, and which search term is actually driving it.
 */
export function stateInsights(data, state, viewMode, weekIndex, means) {
  const { index, delta } = readingAt(state, viewMode, weekIndex);
  const tier = tierFor(index);
  const national = nationalAt(data, viewMode, weekIndex);
  const { rank, total } = nationalRank(data, state.code, viewMode, weekIndex);
  const ownAvg = state.outlook.storm_index;

  const h = state.history;
  const fourWeeksAgo = h[Math.max(0, weekIndex - 4)]?.storm_index ?? index;

  // Which term stands out most against the same term elsewhere in the country.
  let leading = null;
  data.meta.terms.forEach((term) => {
    const score = state.current.term_scores?.[term] ?? 0;
    const lift = score - (means?.[term] ?? 0);
    if (!leading || lift > leading.lift) leading = { term, score, lift: Math.round(lift) };
  });

  return {
    index,
    delta,
    tier,
    rank,
    total,
    national,
    vsNational: index - national,
    vsOwnAvg: ownAvg > 0 ? Math.round(((index - ownAvg) / ownAvg) * 100) : 0,
    ownAvg,
    change4w: viewMode === 'outlook' ? null : index - fourWeeksAgo,
    streak: viewMode === 'outlook' ? null : streakAt(state, weekIndex),
    peak: state.outlook.peak,
    low: state.outlook.low,
    leading,
  };
}

/**
 * The one-line note under the headline number — whether this reading is normal
 * for this state or genuinely unusual, which is the thing a rank cannot say.
 */
export function contextNote(insights, viewMode) {
  if (viewMode === 'outlook') {
    return `Averaged ${insights.ownAvg} across the last 12 months, peaking at ${insights.peak.storm_index} in the week of ${formatWeek(insights.peak.week)}.`;
  }
  const pct = insights.vsOwnAvg;
  if (Math.abs(pct) < 8) {
    return `Search interest in these terms is running about level with this state's own yearly average.`;
  }
  return `Search interest in these terms is ${Math.abs(pct)}% ${pct > 0 ? 'above' : 'below'} this state's own yearly average.`;
}
