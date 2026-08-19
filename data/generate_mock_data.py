#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_mock_data.py — SYNTHETIC dataset generator for the Mental Health Weather Map.

  ############################################################################
  #  THE DATA THIS SCRIPT PRODUCES IS 100% SYNTHETIC. IT IS NOT REAL.        #
  #  It is fabricated by a random number generator so the demo runs with     #
  #  zero setup, zero API keys and zero internet access. It must never be    #
  #  presented as a real measurement of anything. Every record it writes is  #
  #  stamped `meta.is_synthetic = true`, and the UI shows a "SIMULATED DATA" #
  #  badge plus a full explanation whenever that flag is set.                #
  ############################################################################

Why this exists
---------------
`fetch_trends.py` pulls the real thing from Google Trends via pytrends, but that
API is unofficial, aggressively rate limited, and unavailable offline -- exactly
the conditions of a live demo. So the app ships with this generator's output and
`fetch_trends.py` is strictly optional. Both scripts write the identical schema
to the same path (see schema.py), so switching to real data is a file swap, not
a code change.

What it models
--------------
Not noise -- the shape India's year actually has:

  * an annual cycle that peaks across the exam-and-heat months and troughs after
    the monsoon, rather than the winter-peaking curve a northern-hemisphere
    temperate country would show;
  * the exam calendar, which is the single loudest stress signal in India:
    board exams in February and March, JEE and NEET in late April and May, then
    results and admissions through June;
  * the financial year ending on 31 March, which is appraisal and target season;
  * the monsoon's advance -- onset reaches Kerala around 1 June and the far north
    about five weeks later, so relief sweeps south to north across the map, with
    the disruption of peak rain following behind it;
  * the festive season, and the northern winter's cold and air-quality months;
  * a damped random walk, so week-to-week movement is smooth, not jittery;
  * discrete storm events, some landing on the final weeks so the opening screen
    has live storms, the rest scattered so the replay has history.

Usage
-----
    python3 data/generate_mock_data.py                 # -> data/trends_data.json
    python3 data/generate_mock_data.py --seed 7        # a different weather week
    python3 data/generate_mock_data.py --out other.json

Only the Python standard library is used. No dependencies, no network.
The JSON schema is documented in full in schema.py.
"""

from __future__ import annotations

import argparse
import json
import math
import random
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from schema import (
    SCHEMA_VERSION, STATES, STORM_INDEX_DEFINITION, TERM_LABELS, TERM_WEIGHTS, TERMS, TIERS,
    clamp_int, last_sunday, make_rescaler, prettify_query, summarize_national,
    summarize_state, validate,
)

# --------------------------------------------------------------------------
# Calibration. BASE_SPREAD widens the gap between calm and busy states around
# BASE_CENTER before the shared rescale in schema.make_rescaler() runs. Together
# they keep the map legible: on any given week there are genuinely calm states
# and genuinely stormy ones, so all five bands are readable on screen.
# --------------------------------------------------------------------------
BASE_CENTER = 52.0
BASE_SPREAD = 1.55

# --------------------------------------------------------------------------
# Rising-query pools. Real Google Trends returns raw, messy, lowercase query
# strings; we imitate that in `query` and provide a tidied `plain` for display.
# --------------------------------------------------------------------------
QUERY_POOL = {
    "anxiety symptoms": [
        "anxiety symptoms in hindi", "physical symptoms of anxiety", "anxiety chest pain",
        "morning anxiety", "anxiety attack symptoms", "anxiety ka ilaj",
    ],
    "panic attack": [
        "how to stop a panic attack", "panic attack at night", "panic attack symptoms",
        "panic attack kya hota hai", "panic attack while travelling",
    ],
    "can't sleep": [
        "neend nahi aati", "cant sleep at night", "insomnia home remedy",
        "why cant i fall asleep", "sleep problem solution",
    ],
    "exam stress": [
        "exam stress relief", "board exam anxiety", "how to focus while studying",
        "exam fear kaise dur kare", "night before exam anxiety",
    ],
    "work stress": [
        "work life balance", "toxic workplace signs", "office stress relief",
        "job pressure handle", "manager stress",
    ],
    "burnout": [
        "burnout recovery", "signs of burnout at work", "burnout vs depression",
        "student burnout", "how long does burnout last",
    ],
    "psychiatrist near me": [
        "free counselling india", "online therapy india", "tele manas helpline",
        "psychologist vs psychiatrist", "counsellor near me", "therapy cost india",
    ],
    "तनाव": [
        "तनाव कम करने के उपाय", "तनाव के लक्षण", "मानसिक तनाव",
        "तनाव से कैसे बचें",
    ],
}

# Region-flavoured queries, so a state's chips feel local rather than generic.
REGIONAL_QUERIES = {
    "coaching_hubs": (["RJ", "DL", "UP", "BR", "TG", "MH"],
                      ["kota coaching stress", "hostel homesickness", "dropper year anxiety"]),
    "it_metros": (["KA", "MH", "TG", "TN", "HR", "UP", "DL"],
                  ["layoff anxiety", "appraisal stress", "commute stress", "notice period tension"]),
    "farm_distress": (["MH", "PB", "TG", "KA", "MP", "UP", "OD"],
                      ["crop loss tension", "farm loan stress"]),
    "flood_landslide": (["KL", "AS", "BR", "UK", "WB", "HP", "SK", "TR"],
                        ["flood anxiety", "landslide fear", "monsoon damage"]),
    "heat": (["RJ", "DL", "UP", "HR", "MP", "TG", "AP", "GJ", "CH"],
             ["heat wave sleeplessness", "garmi me neend nahi"]),
    "air_quality": (["DL", "HR", "PB", "UP", "BR", "CH"],
                    ["pollution anxiety", "aqi today", "air purifier for home"]),
    "migration": (["BR", "UP", "OD", "JH", "WB", "AS", "MN"],
                  ["homesickness", "ghar ki yaad", "working away from family"]),
    "remote_hills": (["SK", "ML", "MZ", "NL", "AR", "MN", "TR", "LA", "AN", "LD"],
                     ["loneliness help", "isolation feeling", "counsellor online"]),
}

# Month-flavoured queries, so the snapshot reads as "this time of year".
SEASONAL_QUERIES = {
    1:  ["new year resolution stress", "winter blues"],
    2:  ["board exam anxiety", "exam stress relief"],
    3:  ["board exam result date", "financial year end stress"],
    4:  ["jee mains stress", "appraisal stress", "heat wave sleeplessness"],
    5:  ["neet exam stress", "board result anxiety"],
    6:  ["college admission stress", "neet result stress", "monsoon mood"],
    7:  ["monsoon sadness", "flood anxiety"],
    8:  ["hostel homesickness", "first year college anxiety"],
    9:  ["work deadline stress", "festive season pressure"],
    10: ["diwali stress", "festive loneliness"],
    11: ["pollution anxiety", "post diwali blues"],
    12: ["year end burnout", "exam preparation stress"],
}


def gaussian_bump(x: float, center: float, width: float, height: float,
                  wrap: float | None = None) -> float:
    """A Gaussian bump. If `wrap` is given, it wraps around that period."""
    delta = abs(x - center)
    if wrap:
        delta = min(delta, wrap - delta)
    return height * math.exp(-(delta ** 2) / (2 * width ** 2))


def seasonal_component(d: date, lat: float) -> float:
    """Calendar-driven pressure on the index, in index points."""
    doy = d.timetuple().tm_yday

    # Broad annual cycle: peaks across the exam-and-heat months, troughs in the
    # settled weeks after the monsoon withdraws.
    base = 6.0 * math.cos(2 * math.pi * (doy - 135) / 365.0)

    # Summer heat bites harder the further north you go.
    heat = max(0.0, lat - 8.0) * 0.20

    events = (
        gaussian_bump(doy, 62, 13, 6.0, 365)      # mid-Feb to Mar: board exams
        + gaussian_bump(doy, 88, 7, 3.2, 365)     # 31 Mar: financial year end
        + gaussian_bump(doy, 125, 11, 5.5, 365)   # late Apr/May: JEE, NEET
        + gaussian_bump(doy, 158, 10, 6.5, 365)   # Jun: results and admissions
        + gaussian_bump(doy, 150, 26, heat, 365)  # Apr-Jun heat, by latitude
        + gaussian_bump(doy, 300, 12, 4.0, 365)   # Oct-Nov: festive season
        + gaussian_bump(doy, 5, 8, 3.0, 365)      # new year
    )

    # Northern winter: cold, plus the post-Diwali air-quality season.
    north = max(0.0, lat - 22.0) * 0.32
    events += gaussian_bump(doy, 330, 26, north, 365)

    return base + events


def monsoon(d: date, lat: float) -> float:
    """The monsoon's advance — the year's big spatial event.

    Onset reaches Kerala around 1 June and the far north roughly five weeks
    later, so this term sweeps south to north across the map over the replay.
    Arrival brings a dip (relief after the heat); the weeks of heaviest rain
    behind the front bring a rise (flooding, disruption, damp).
    """
    doy = d.timetuple().tm_yday
    onset = 152 + (lat - 8.0) * 1.15
    return (-5.0 * gaussian_bump(doy, onset, 11, 1.0, 365)
            + 3.4 * gaussian_bump(doy, onset + 46, 19, 1.0, 365))


def drift(week_i: int, lon: float) -> float:
    """A slow east-west ripple, for texture under the seasonal signal."""
    phase = (lon - 68.0) / 30.0
    return 2.2 * math.sin(2 * math.pi * (week_i / 26.0 - phase))


def build_state_raw(rng: random.Random, weeks: list[date], lat: float, lon: float,
                    base: float, spike_events: list[tuple[float, float, float]]) -> list[float]:
    """Raw weekly signal for one state, oldest -> newest.

    Returned unclamped and un-normalized: `generate()` rescales every state
    together afterwards, which is what keeps states comparable to each other.
    """
    base = BASE_CENTER + (base - BASE_CENTER) * BASE_SPREAD
    series: list[float] = []
    walk = 0.0
    for i, wk in enumerate(weeks):
        # Damped random walk -> smooth week-to-week motion, not independent jitter.
        walk = walk * 0.72 + rng.gauss(0, 2.4)
        value = (
            base
            + seasonal_component(wk, lat)
            + monsoon(wk, lat)
            + drift(i, lon)
            + walk
            + (i / len(weeks)) * 2.0            # mild upward drift over the year
        )
        for center, width, height in spike_events:
            value += gaussian_bump(i, center, width, height)
        series.append(value)
    return series


def pick_rising_queries(rng: random.Random, code: str, current_month: int, n: int = 4) -> list[dict]:
    """Assemble a plausible, locally-flavoured set of rising queries."""
    pool: list[str] = []
    for _term, queries in QUERY_POOL.items():
        pool.extend(rng.sample(queries, 2))
    for _key, (codes, queries) in REGIONAL_QUERIES.items():
        if code in codes:
            pool.extend(queries * 2)          # doubled -> likelier to be drawn
    pool.extend(SEASONAL_QUERIES[current_month] * 2)

    chosen: list[str] = []
    for q in rng.sample(pool, k=min(len(pool), n * 4)):
        if q not in chosen:
            chosen.append(q)
        if len(chosen) == n:
            break

    out = []
    for i, q in enumerate(chosen):
        # Google Trends reports either a percentage rise or "Breakout" (>5000%).
        breakout = rng.random() < 0.15
        value = 5000 if breakout else int(rng.triangular(40, 400, 110) - i * 8)
        out.append({
            "query": q,
            "plain": prettify_query(q),
            "value": value,
            "formatted": "Breakout" if breakout else f"+{max(value, 20)}%",
        })
    out.sort(key=lambda r: -r["value"])
    return out


def build_term_scores(rng: random.Random, index: int, month: int) -> dict[str, int]:
    """Split a composite index back into believable per-term scores.

    Each term wobbles around the composite with its own seasonal personality --
    exam terms spike around the board and entrance months, sleep terms run hot
    in the summer, work stress peaks around the March financial year end.
    """
    seasonal_tilt = {
        "anxiety symptoms": 0.0,
        "panic attack": 0.0,
        "can't sleep": 6.0 if month in (4, 5, 6) else (3.0 if month in (12, 1) else 0.0),
        "exam stress": 12.0 if month in (2, 3, 5, 6) else (5.0 if month in (4, 12) else -4.0),
        "work stress": 6.0 if month in (3, 4) else 0.0,
        "burnout": 4.0 if month in (9, 10, 11) else -2.0,
        "psychiatrist near me": 4.0 if month in (1, 6) else 0.0,
        "तनाव": 3.0 if month in (2, 3, 5, 6) else 0.0,
    }
    return {
        term: clamp_int(index * TERM_WEIGHTS[term] ** 0.5 + seasonal_tilt[term] + rng.gauss(0, 4.5))
        for term in TERMS
    }


def generate(seed: int, weeks_count: int, today: date) -> dict:
    rng = random.Random(seed)

    end = last_sunday(today)
    weeks = [end - timedelta(weeks=(weeks_count - 1 - i)) for i in range(weeks_count)]
    week_strs = [w.isoformat() for w in weeks]

    # Storm events. Two live systems are deliberately large so the top band is
    # always represented on the opening screen.
    codes = [s[0] for s in STATES]
    live_storm_states = rng.sample(codes, 6)
    historic_storm_states = rng.sample([c for c in codes if c not in live_storm_states], 9)

    spikes: dict[str, list[tuple[float, float, float]]] = {c: [] for c in codes}
    for i, c in enumerate(live_storm_states):
        height = rng.uniform(40, 50) if i < 2 else rng.uniform(18, 32)
        centre = weeks_count - 1 - rng.uniform(0, 2.5)
        spikes[c].append((centre, rng.uniform(3.0, 6.0), height))
    for c in historic_storm_states:
        spikes[c].append((rng.uniform(4, weeks_count - 8), rng.uniform(2.5, 5.0), rng.uniform(14, 30)))

    # Pass 1: raw signal per state.
    raw = {code: build_state_raw(rng, weeks, lat, lon, base, spikes[code])
           for code, _n, _iso, lat, lon, base in STATES}

    # Pass 2: one shared rescale fitted across every state and week.
    rescale = make_rescaler([v for series in raw.values() for v in series])

    states_out = []
    for code, name, iso, _lat, _lon, _base in STATES:
        series = [rescale(v) for v in raw[code]]
        states_out.append(summarize_state(
            code, name, iso, week_strs, series,
            build_term_scores(rng, series[-1], weeks[-1].month),
            pick_rising_queries(rng, code, weeks[-1].month),
        ))
    states_out.sort(key=lambda s: s["name"])

    return {
        "meta": {
            "schema_version": SCHEMA_VERSION,
            "generated_at": datetime.now(timezone.utc).replace(microsecond=0)
                                    .isoformat().replace("+00:00", "Z"),
            "source": "synthetic-mock",
            "is_synthetic": True,
            "source_label": "Simulated data",
            "data_notice": (
                "This dataset is SYNTHETIC. It was produced by a random-number "
                "generator in data/generate_mock_data.py so the demo runs offline "
                "with no API keys. It models plausible seasonal and regional "
                "patterns for India, but it is not a measurement and describes no "
                "real population. Run data/fetch_trends.py to replace it with real "
                "aggregated Google Trends data."
            ),
            "history_mode": "synthetic",
            "notes": [
                "Every value here is simulated. No real person, population or "
                "search log is represented.",
                "The seasonal shapes are modelled deliberately — board exams, JEE "
                "and NEET, results season, the 31 March financial year end, the "
                "monsoon's advance from south to north, the festive season and the "
                "northern winter — so the visualization behaves like the real "
                "signal would.",
            ],
            "geo": "IN",
            "terms": TERMS,
            "term_labels": TERM_LABELS,
            "term_weights": TERM_WEIGHTS,
            "timeframe": {
                "start": week_strs[0],
                "end": week_strs[-1],
                "weeks": weeks_count,
                "resolution": "weekly",
            },
            "storm_index": {"definition": STORM_INDEX_DEFINITION, "tiers": TIERS},
            "generator": {"seed": seed},
        },
        "national": summarize_national(week_strs, states_out),
        "states": states_out,
    }


def main() -> None:
    default_out = Path(__file__).resolve().parent / "trends_data.json"
    ap = argparse.ArgumentParser(description="Generate the synthetic trends dataset.")
    ap.add_argument("--seed", type=int, default=20260819,
                    help="RNG seed; same seed => identical output (default: 20260819)")
    ap.add_argument("--weeks", type=int, default=52, help="number of weekly points (default: 52)")
    ap.add_argument("--out", type=Path, default=default_out, help="output path")
    args = ap.parse_args()

    payload = generate(args.seed, args.weeks, date.today())

    problems = validate(payload)
    if problems:
        raise SystemExit("generated dataset failed schema validation:\n  - " + "\n  - ".join(problems))

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(payload, indent=1, ensure_ascii=False), encoding="utf-8")

    nat = payload["national"]["current"]
    hot = sorted(payload["states"], key=lambda s: -s["current"]["storm_index"])[:5]
    tier_counts: dict[str, int] = {}
    for s in payload["states"]:
        tier_counts[s["current"]["tier"]] = tier_counts.get(s["current"]["tier"], 0) + 1

    print(f"[mock] wrote {args.out} ({args.out.stat().st_size / 1024:.0f} KB)")
    print("[mock] SYNTHETIC DATA -- not a real measurement")
    print(f"[mock] region India, {len(payload['states'])} states/UTs")
    print(f"[mock] window {payload['meta']['timeframe']['start']} -> {payload['meta']['timeframe']['end']}")
    print(f"[mock] national index {nat['storm_index']} ({nat['tier']}), "
          f"{payload['national']['states_under_storm_watch']} under storm watch")
    print("[mock] today's bands: " + "  ".join(
        f"{t['label']}={tier_counts.get(t['key'], 0)}" for t in TIERS))
    print("[mock] hottest: " + ", ".join(f"{s['code']} {s['current']['storm_index']}" for s in hot))


if __name__ == "__main__":
    main()
