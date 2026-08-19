#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
schema.py — the single source of truth for the Mental Health Weather Map dataset.

Both data producers import from here so they cannot drift apart:

    generate_mock_data.py   ->  synthetic dataset (ships with the app)
    fetch_trends.py         ->  real Google Trends dataset (optional)

Both write the same JSON schema to the same path, so replacing simulated data
with real data is a file swap and requires no frontend change.

Run this module directly to validate an existing dataset:

    python3 data/schema.py data/trends_data.json


================================================================================
 JSON SCHEMA v2.0.0  (region: India)
================================================================================

{
  "meta": {
    "schema_version": "2.0.0",
    "generated_at":   "2026-08-19T12:00:00Z",   # ISO-8601 UTC
    "source":         "synthetic-mock",         # | "google-trends"
    "is_synthetic":   true,                     # UI shows a warning badge if true
    "source_label":   "Simulated data",         # short human label for the UI
    "data_notice":    "<one-paragraph plain-language provenance note>",
    "history_mode":   "synthetic",              # | "per-state" | "modeled-from-national"
    "notes":          ["<caveats a viewer should know>"],
    "geo":            "IN",
    "terms":          ["anxiety symptoms", ...],        # the tracked queries
    "term_labels":    {"तनाव": "तनाव — stress", ...},   # display form per term
    "term_weights":   {"panic attack": 1.15, ...},      # weight in the index
    "timeframe": {
      "start": "2025-08-24", "end": "2026-08-16",       # inclusive, Sundays
      "weeks": 52, "resolution": "weekly"
    },
    "storm_index": {
      "definition": "<plain-language description of the 0-100 index>",
      "tiers": [ {"key","label","code","level","min","max","blurb"}, ... ]
    }
  },

  "national": {
    "current":  {"week":"2026-08-16","storm_index":47,"tier":"overcast","delta_wow":3},
    "outlook":  {"storm_index":44,"tier":"overcast"},   # trailing 12-month mean
    "history":  [ {"week":"2025-08-24","storm_index":42}, ... 52 items ],
    "states_under_storm_watch": 6                       # states with index >= 66
  },

  "states": [                                           # 28 states + 8 UTs, A-Z
    {
      "code": "KA", "name": "Karnataka", "iso": "IN-KA",

      "current": {                       # latest week  -> "Current Conditions"
        "week": "2026-08-16",
        "storm_index": 72,               # 0-100
        "tier": "storm",                 # clear|hazy|overcast|storm|cloudburst
        "delta_wow": 6,                  # change vs previous week, signed
        "pct_vs_state_avg": 34,          # % above/below this state's own mean
        "term_scores": {"anxiety symptoms": 78, ...}   # per-term 0-100
      },

      "outlook": {                       # trailing 12 months -> "12-Month Outlook"
        "storm_index": 58,               # mean over the window
        "tier": "overcast",
        "peak": {"week": "2026-06-07", "storm_index": 88},
        "low":  {"week": "2025-10-05", "storm_index": 31}
      },

      "history": [ {"week":"2025-08-24","storm_index":51}, ... 52 items ],

      "rising_queries": [                # "What's brewing" chips; may be []
        {"query":"exam stress relief","plain":"Exam stress relief",
         "value":180,"formatted":"+180%"}
      ]
    }
  ]
}

Invariants the frontend relies on
---------------------------------
* `history` is ordered oldest -> newest, one entry per week in `meta.timeframe`.
* `history[-1].storm_index == current.storm_index` for the same state.
* Every state's `history` has the same weeks, in the same order.
* All index values are ints in [0, 100]; `tier` always matches its index.
* `rising_queries` may be [] (real Trends often has none for small regions).
"""

from __future__ import annotations

import math
from datetime import date, timedelta

SCHEMA_VERSION = "2.0.0"

# --------------------------------------------------------------------------
# Tracked search terms.
#
# Everyday phrasings people in India actually type, not clinical vocabulary:
# "exam stress" carries far more signal here than it would elsewhere (board
# exams, JEE, NEET), "psychiatrist near me" is the more common help-seeking
# phrasing than "therapist", and a large share of searching happens in Hindi,
# so the basket would be measurably wrong if it were English-only.
# --------------------------------------------------------------------------
TERMS = [
    "anxiety symptoms",
    "panic attack",
    "can't sleep",
    "exam stress",
    "work stress",
    "burnout",
    "psychiatrist near me",
    "तनाव",
]

# Display forms. Non-Latin terms carry an English gloss so the UI never shows a
# reader a term they cannot parse.
TERM_LABELS = {
    "तनाव": "तनाव — stress",
}

# How much each term contributes to the Storm Index. Acute-distress phrasings
# ("panic attack") are weighted a little higher than help-seeking ones
# ("psychiatrist near me"), which reflect intent to act more than distress itself.
TERM_WEIGHTS = {
    "anxiety symptoms": 1.00,
    "panic attack": 1.15,
    "can't sleep": 0.90,
    "exam stress": 1.05,
    "work stress": 1.00,
    "burnout": 0.85,
    "psychiatrist near me": 0.80,
    "तनाव": 1.00,
}

# --------------------------------------------------------------------------
# The five bands.
#
# Colour codes follow the India Meteorological Department's warning ladder --
# Green (no warning), Yellow (watch), Orange (alert), Red (warning) -- because
# that is the vocabulary an Indian audience already reads fluently off a monsoon
# bulletin. Green covers the two calm bands, which keeps the median state at
# "watch" rather than overstating it as an alert.
#
# Keep in sync with src/lib/stormIndex.js.
# --------------------------------------------------------------------------
TIERS = [
    {"key": "clear", "label": "Clear", "code": "Green", "level": "No warning",
     "min": 0, "max": 20,
     "blurb": "Barely any stress-related searching"},
    {"key": "hazy", "label": "Hazy", "code": "Green", "level": "No warning",
     "min": 21, "max": 40,
     "blurb": "A little more searching than usual"},
    {"key": "overcast", "label": "Overcast", "code": "Yellow", "level": "Watch",
     "min": 41, "max": 65,
     "blurb": "Noticeably elevated — worth watching"},
    {"key": "storm", "label": "Storm", "code": "Orange", "level": "Alert",
     "min": 66, "max": 85,
     "blurb": "A sharp rise — a stress system is sitting over this state"},
    {"key": "cloudburst", "label": "Cloudburst", "code": "Red", "level": "Warning",
     "min": 86, "max": 100,
     "blurb": "Among the highest search interest on the map"},
]

STORM_WATCH_THRESHOLD = 66  # index at or above this counts as "under storm watch"

STORM_INDEX_DEFINITION = (
    "A 0-100 composite of how often people in a state searched a fixed basket of "
    "everyday stress and anxiety phrases, relative to all searches from that state. "
    "It is a normalized weighted average of the tracked terms' regional search "
    "interest -- 0 means the quietest observed conditions, 100 the busiest. It "
    "measures search behaviour, not people, and not illness."
)

# --------------------------------------------------------------------------
# Normalization anchors, shared by both producers.
#
# Google Trends' own "interest by region" is already a 0-100 scale with the
# busiest region pinned at 100, so rescaling is faithful to how the source data
# behaves. Mapping the 1st/99th percentile of observed values onto these anchors
# also keeps the map legible: on any given week there are genuinely calm states
# and genuinely stormy ones, instead of 36 states of identical yellow.
# --------------------------------------------------------------------------
NORM_LOW_PCT, NORM_LOW_INDEX = 1.0, 9.0
NORM_HIGH_PCT, NORM_HIGH_INDEX = 99.0, 92.0

# --------------------------------------------------------------------------
# The 28 states and 8 union territories, with the ISO 3166-2:IN code Google
# Trends uses for per-region queries, an approximate centroid, and a synthetic
# "baseline" search-interest level.
#
# lat / lon / base are used ONLY by the synthetic generator:
#   lat  -> how hard the summer and the northern winter bite, and when the
#           monsoon arrives (it advances south to north over about five weeks)
#   lon  -> a small east-west phase offset, for texture
#   base -> an invented resting level. NOT a real statistic about these places.
# `fetch_trends.py` uses only code / name / iso.
# --------------------------------------------------------------------------
STATES = [
    ("AN", "Andaman & Nicobar Islands", "IN-AN", 11.7, 92.7, 45),
    ("AP", "Andhra Pradesh",            "IN-AP", 15.9, 79.7, 53),
    ("AR", "Arunachal Pradesh",         "IN-AR", 28.2, 94.7, 43),
    ("AS", "Assam",                     "IN-AS", 26.2, 92.9, 47),
    ("BR", "Bihar",                     "IN-BR", 25.8, 85.3, 48),
    ("CH", "Chandigarh",                "IN-CH", 30.7, 76.8, 64),
    ("CG", "Chhattisgarh",              "IN-CT", 21.3, 82.0, 48),
    ("DD", "Dadra & Nagar Haveli and Daman & Diu", "IN-DH", 20.3, 73.0, 50),
    ("DL", "Delhi",                     "IN-DL", 28.6, 77.1, 66),
    ("GA", "Goa",                       "IN-GA", 15.3, 74.0, 59),
    ("GJ", "Gujarat",                   "IN-GJ", 22.7, 71.6, 54),
    ("HR", "Haryana",                   "IN-HR", 29.2, 76.3, 58),
    ("HP", "Himachal Pradesh",          "IN-HP", 31.9, 77.2, 54),
    ("JK", "Jammu & Kashmir",           "IN-JK", 33.8, 75.3, 52),
    ("JH", "Jharkhand",                 "IN-JH", 23.6, 85.3, 49),
    ("KA", "Karnataka",                 "IN-KA", 15.0, 75.7, 62),
    ("KL", "Kerala",                    "IN-KL", 10.5, 76.3, 61),
    ("LA", "Ladakh",                    "IN-LA", 34.5, 77.6, 44),
    ("LD", "Lakshadweep",               "IN-LD", 10.6, 72.6, 41),
    ("MP", "Madhya Pradesh",            "IN-MP", 23.5, 78.5, 50),
    ("MH", "Maharashtra",               "IN-MH", 19.6, 75.7, 60),
    ("MN", "Manipur",                   "IN-MN", 24.7, 93.9, 45),
    ("ML", "Meghalaya",                 "IN-ML", 25.5, 91.3, 44),
    ("MZ", "Mizoram",                   "IN-MZ", 23.3, 92.8, 43),
    ("NL", "Nagaland",                  "IN-NL", 26.1, 94.5, 42),
    ("OD", "Odisha",                    "IN-OR", 20.5, 84.6, 50),
    ("PY", "Puducherry",                "IN-PY", 11.9, 79.8, 55),
    ("PB", "Punjab",                    "IN-PB", 31.1, 75.4, 56),
    ("RJ", "Rajasthan",                 "IN-RJ", 26.9, 73.8, 57),
    ("SK", "Sikkim",                    "IN-SK", 27.6, 88.5, 46),
    ("TN", "Tamil Nadu",                "IN-TN", 11.1, 78.5, 58),
    ("TG", "Telangana",                 "IN-TG", 17.9, 79.0, 60),
    ("TR", "Tripura",                   "IN-TR", 23.8, 91.7, 46),
    ("UP", "Uttar Pradesh",             "IN-UP", 26.9, 80.9, 52),
    ("UK", "Uttarakhand",               "IN-UT", 30.1, 79.2, 57),
    ("WB", "West Bengal",               "IN-WB", 23.5, 87.9, 55),
]

# Google Trends returns region names in its own spelling; map them onto our codes.
STATE_BY_NAME = {name: (code, iso) for code, name, iso, *_ in STATES}
TRENDS_NAME_ALIASES = {
    "Andaman and Nicobar Islands": "AN",
    "Dadra and Nagar Haveli": "DD",
    "Dadra and Nagar Haveli and Daman and Diu": "DD",
    "Daman and Diu": "DD",
    "Jammu and Kashmir": "JK",
    "National Capital Territory of Delhi": "DL",
    "NCT": "DL",
    "Orissa": "OD",
    "Pondicherry": "PY",
    "Uttaranchal": "UK",
}

# Fallbacks for small states/UTs that often lack Google Trends data.
# Maps the missing state's code to the code of a nearby state with strong data.
STATE_FALLBACKS = {
    "LA": "JK",  # Ladakh -> Jammu & Kashmir
    "AN": "TN",  # Andaman & Nicobar -> Tamil Nadu
    "LD": "KL",  # Lakshadweep -> Kerala
    "DD": "GJ",  # Dadra & Nagar Haveli / Daman & Diu -> Gujarat (if ever missing)
}

CONTRACTIONS = {"cant": "can't", "wont": "won't", "dont": "don't", "im": "I'm", "whats": "what's"}


def resolve_state_code(region_name: str) -> str | None:
    """Map a Google Trends region label onto our state code, or None."""
    name = str(region_name).strip()
    if name in STATE_BY_NAME:
        return STATE_BY_NAME[name][0]
    if name in TRENDS_NAME_ALIASES:
        return TRENDS_NAME_ALIASES[name]
    # Fall back to a loose match ignoring "and"/"&" and case.
    norm = name.lower().replace("&", "and").replace("  ", " ")
    for code, canonical, *_rest in STATES:
        if canonical.lower().replace("&", "and") == norm:
            return code
    return None


def prettify_query(q: str) -> str:
    """Turn a raw search string into a plain-language chip label for the UI."""
    words = [CONTRACTIONS.get(w, w) for w in str(q).strip().split()]
    if not words:
        return str(q)
    out = " ".join(words)
    return out[0].upper() + out[1:]


def term_label(term: str) -> str:
    """Display form of a tracked term, with a gloss where one is needed."""
    return TERM_LABELS.get(term, term)


def tier_for(index: int) -> str:
    """Map a 0-100 Storm Index onto a band key."""
    for t in TIERS:
        if index <= t["max"]:
            return t["key"]
    return TIERS[-1]["key"]


def clamp_int(x: float, lo: int = 0, hi: int = 100) -> int:
    return int(max(lo, min(hi, round(x))))


def last_sunday(d: date) -> date:
    """Google Trends weekly points land on Sundays; match that convention."""
    return d - timedelta(days=(d.weekday() + 1) % 7)


def percentile(sorted_values: list[float], pct: float) -> float:
    """Linear-interpolated percentile of an already-sorted list."""
    if not sorted_values:
        return 0.0
    k = (len(sorted_values) - 1) * (pct / 100.0)
    lo, hi = math.floor(k), math.ceil(k)
    if lo == hi:
        return sorted_values[int(k)]
    return sorted_values[lo] * (hi - k) + sorted_values[hi] * (k - lo)


def make_rescaler(all_values: list[float]):
    """Build the shared 0-100 rescale function from every observed raw value.

    One rescaler is fitted across all states and all weeks, which is what keeps
    states comparable to each other and weeks comparable over time.
    """
    flat = sorted(all_values)
    lo, hi = percentile(flat, NORM_LOW_PCT), percentile(flat, NORM_HIGH_PCT)
    gain = (NORM_HIGH_INDEX - NORM_LOW_INDEX) / max(hi - lo, 1e-6)
    return lambda v: clamp_int(NORM_LOW_INDEX + (v - lo) * gain)


def composite(term_scores: dict[str, float]) -> float:
    """Weighted mean of per-term interest -> the raw (pre-rescale) signal."""
    num = sum(term_scores.get(t, 0.0) * TERM_WEIGHTS[t] for t in TERMS)
    den = sum(TERM_WEIGHTS[t] for t in TERMS if t in term_scores) or 1.0
    return num / den


def summarize_state(code: str, name: str, iso: str, weeks: list[str], series: list[int],
                    term_scores: dict[str, int], rising: list[dict]) -> dict:
    """Assemble one state record from its weekly series. Used by both producers."""
    current_index = series[-1]
    prev_index = series[-2] if len(series) > 1 else current_index
    mean_index = sum(series) / len(series)
    peak_i = max(range(len(series)), key=lambda i: series[i])
    low_i = min(range(len(series)), key=lambda i: series[i])

    return {
        "code": code,
        "name": name,
        "iso": iso,
        "current": {
            "week": weeks[-1],
            "storm_index": current_index,
            "tier": tier_for(current_index),
            "delta_wow": current_index - prev_index,
            "pct_vs_state_avg": int(round((current_index - mean_index) / max(mean_index, 1) * 100)),
            "term_scores": term_scores,
        },
        "outlook": {
            "storm_index": clamp_int(mean_index),
            "tier": tier_for(clamp_int(mean_index)),
            "peak": {"week": weeks[peak_i], "storm_index": series[peak_i]},
            "low": {"week": weeks[low_i], "storm_index": series[low_i]},
        },
        "history": [{"week": w, "storm_index": v} for w, v in zip(weeks, series)],
        "rising_queries": rising,
    }


def summarize_national(weeks: list[str], states_out: list[dict]) -> dict:
    """Derive the national record by averaging every state, week by week."""
    n = len(states_out)
    series = [clamp_int(sum(s["history"][i]["storm_index"] for s in states_out) / n)
              for i in range(len(weeks))]
    mean_index = clamp_int(sum(series) / len(series))
    return {
        "current": {
            "week": weeks[-1],
            "storm_index": series[-1],
            "tier": tier_for(series[-1]),
            "delta_wow": series[-1] - (series[-2] if len(series) > 1 else series[-1]),
        },
        "outlook": {"storm_index": mean_index, "tier": tier_for(mean_index)},
        "history": [{"week": w, "storm_index": v} for w, v in zip(weeks, series)],
        "states_under_storm_watch": sum(
            1 for s in states_out if s["current"]["storm_index"] >= STORM_WATCH_THRESHOLD),
    }


# --------------------------------------------------------------------------
# Validation — run against any dataset before shipping it to the frontend.
# --------------------------------------------------------------------------
def validate(payload: dict) -> list[str]:
    """Return a list of schema violations. Empty list means the dataset is good."""
    errors: list[str] = []

    def need(obj, key, where):
        if key not in obj:
            errors.append(f"{where}: missing '{key}'")
            return False
        return True

    meta = payload.get("meta", {})
    for key in ("schema_version", "generated_at", "source", "is_synthetic", "source_label",
                "data_notice", "geo", "terms", "term_weights", "timeframe", "storm_index"):
        need(meta, key, "meta")

    if meta.get("geo") not in (None, "IN"):
        errors.append(f"meta.geo is {meta.get('geo')!r}, expected 'IN'")

    weeks_expected = meta.get("timeframe", {}).get("weeks")
    week_list = None

    for section in ("national", "states"):
        need(payload, section, "root")

    nat = payload.get("national", {})
    for key in ("current", "outlook", "history", "states_under_storm_watch"):
        need(nat, key, "national")

    states = payload.get("states", [])
    if len(states) != len(STATES):
        errors.append(f"states: expected {len(STATES)} entries, found {len(states)}")

    seen_codes = set()
    for s in states:
        code = s.get("code", "?")
        where = f"state {code}"
        seen_codes.add(code)
        for key in ("code", "name", "iso", "current", "outlook", "history", "rising_queries"):
            need(s, key, where)

        hist = s.get("history", [])
        if weeks_expected and len(hist) != weeks_expected:
            errors.append(f"{where}: history has {len(hist)} weeks, expected {weeks_expected}")

        weeks = [h.get("week") for h in hist]
        if week_list is None:
            week_list = weeks
        elif weeks != week_list:
            errors.append(f"{where}: history weeks differ from other states")

        cur = s.get("current", {})
        if hist and cur.get("storm_index") != hist[-1].get("storm_index"):
            errors.append(f"{where}: current.storm_index != last history point")
        if hist and cur.get("week") != hist[-1].get("week"):
            errors.append(f"{where}: current.week != last history week")

        for h in hist:
            v = h.get("storm_index")
            if not isinstance(v, int) or not (0 <= v <= 100):
                errors.append(f"{where}: history value {v!r} out of range")
                break

        if cur.get("tier") != tier_for(cur.get("storm_index", 0)):
            errors.append(f"{where}: current.tier does not match its index")

        for term in TERMS:
            if term not in cur.get("term_scores", {}):
                errors.append(f"{where}: term_scores missing '{term}'")
                break

        for rq in s.get("rising_queries", []):
            if not all(k in rq for k in ("query", "plain", "value", "formatted")):
                errors.append(f"{where}: malformed rising_queries entry")
                break

    missing = {c for c, *_ in STATES} - seen_codes
    if missing:
        errors.append(f"states: missing {', '.join(sorted(missing))}")

    return errors


if __name__ == "__main__":
    import json
    import sys
    from pathlib import Path

    target = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).parent / "trends_data.json")
    data = json.loads(target.read_text(encoding="utf-8"))
    problems = validate(data)
    if problems:
        print(f"INVALID: {target} ({len(problems)} problem(s))")
        for p in problems:
            print(f"  - {p}")
        sys.exit(1)
    print(f"VALID: {target}")
    print(f"  schema {data['meta']['schema_version']}  source={data['meta']['source']}  "
          f"synthetic={data['meta']['is_synthetic']}")
    print(f"  {len(data['states'])} states/UTs x {data['meta']['timeframe']['weeks']} weeks  "
          f"({data['meta']['timeframe']['start']} -> {data['meta']['timeframe']['end']})")
