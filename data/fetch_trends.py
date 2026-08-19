#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fetch_trends.py — OPTIONAL real-data fetch from Google Trends (best effort).

  The app does NOT need this script. It ships with a synthetic dataset from
  generate_mock_data.py so the demo runs offline with no setup. Run this only
  when you want real numbers, and never in the five minutes before a demo:
  pytrends wraps an *unofficial*, undocumented endpoint that is aggressively
  rate limited and can start returning 429s without warning.

  If this script fails, nothing breaks -- the previous data/trends_data.json is
  left untouched (it is only overwritten after a successful, validated fetch).

Setup
-----
    pip install -r data/requirements.txt
    python3 data/fetch_trends.py                    # ~2 min, default mode
    python3 data/fetch_trends.py --history per-state --rising per-state
                                                    # ~30-60 min, rate-limit prone

Output is data/trends_data.json in exactly the schema documented in schema.py,
so the frontend reads real data with no code change.

--------------------------------------------------------------------------------
 What is actually fetched, and what is derived
--------------------------------------------------------------------------------
Google Trends does not expose "weekly time series per state per term" in one
call, so this script is explicit about which numbers are measured and which are
derived. Every run records this in `meta.history_mode` and `meta.notes`.

  MEASURED in every mode:
    * national weekly interest per term       (interest_over_time, 12 months)
    * per-state interest per term, 12 months  (interest_by_region, 12 months)
    * per-state interest per term, this week  (interest_by_region, last 7 days)

  --history modeled  (DEFAULT, ~10 requests)
    Per-state weekly history is DERIVED: the measured national weekly shape is
    scaled to each state's measured 12-month level, then pinned so its final
    week matches that state's measured current level. Every state therefore has
    a real level and a real current reading, but a shared national shape.
    -> meta.history_mode = "modeled-from-national"

  --history per-state  (~110 requests, slow, often rate limited)
    Per-state weekly history is MEASURED, one interest_over_time call per state
    with geo=IN-XX. Slower and far likelier to hit 429s, but fully real.
    -> meta.history_mode = "per-state"

Cross-request normalization
---------------------------
Google Trends normalizes each *request* independently, so values from two
requests are not comparable. This script keeps one anchor term present in every
batch and rescales each batch onto the anchor, which is the standard way to make
multi-batch Trends data comparable.
"""

from __future__ import annotations

import argparse
import json
import random
import sys
import time
from datetime import date, datetime, timezone
from pathlib import Path

from schema import (
    SCHEMA_VERSION, STATES, STORM_INDEX_DEFINITION, TERM_LABELS, TERMS, TERM_WEIGHTS,
    TIERS, clamp_int, composite, make_rescaler, prettify_query, resolve_state_code,
    summarize_national, summarize_state, validate,
)

GEO = "IN"  # India; per-state queries use each row's ISO 3166-2 code (IN-KA, ...)

MAX_TERMS_PER_REQUEST = 5          # Google Trends' hard limit
ANCHOR_TERM = TERMS[0]             # present in every batch, used to rescale batches


def require_pytrends():
    try:
        from pytrends.request import TrendReq  # noqa: F401
        import pandas  # noqa: F401
    except ImportError:
        sys.exit(
            "fetch_trends.py needs pytrends and pandas:\n"
            "    pip install -r data/requirements.txt\n\n"
            "This script is optional -- the app already ships with a working\n"
            "synthetic dataset. Run: python3 data/generate_mock_data.py"
        )
    from pytrends.request import TrendReq
    return TrendReq


# --------------------------------------------------------------------------
# Request plumbing: batching, retries, backoff.
# --------------------------------------------------------------------------
def build_batches() -> list[list[str]]:
    """Split TERMS into <=5-term batches, with ANCHOR_TERM in each one."""
    rest = [t for t in TERMS if t != ANCHOR_TERM]
    batches, step = [], MAX_TERMS_PER_REQUEST - 1
    for i in range(0, len(rest), step):
        batches.append([ANCHOR_TERM] + rest[i:i + step])
    return batches or [[ANCHOR_TERM]]


class Fetcher:
    """Thin pytrends wrapper adding polite pacing, retries and 429 backoff."""

    def __init__(self, tries: int, base_sleep: float, verbose: bool = True):
        TrendReq = require_pytrends()
        # retries/backoff_factor also arm urllib3's own retry layer underneath.
        # hl/tz set for India so Trends returns Indian region names and IST-aligned weeks.
        self.pytrends = TrendReq(hl="en-IN", tz=330, timeout=(10, 30), retries=2, backoff_factor=0.5)
        self.tries = tries
        self.base_sleep = base_sleep
        self.verbose = verbose
        self.requests_made = 0

    def log(self, msg: str) -> None:
        if self.verbose:
            print(f"[trends] {msg}", flush=True)

    def _call(self, label: str, build_payload_kwargs: dict, extract):
        """Run one Trends request with exponential backoff + jitter."""
        delay = 4.0
        for attempt in range(1, self.tries + 1):
            try:
                time.sleep(self.base_sleep)          # polite pacing between calls
                self.pytrends.build_payload(**build_payload_kwargs)
                result = extract()
                self.requests_made += 1
                return result
            except Exception as exc:                 # noqa: BLE001 - pytrends raises broadly
                is_rate_limit = "429" in str(exc) or "TooManyRequests" in type(exc).__name__
                if attempt == self.tries:
                    self.log(f"{label}: giving up after {attempt} attempts ({exc})")
                    raise
                wait = delay * (1.0 + random.random() * 0.4)
                if is_rate_limit:
                    wait *= 3.0                      # rate limits need real patience
                self.log(f"{label}: attempt {attempt} failed ({type(exc).__name__}) -> "
                         f"retrying in {wait:.0f}s")
                time.sleep(wait)
                delay = min(delay * 2, 180.0)
        raise RuntimeError("unreachable")

    def interest_over_time(self, terms: list[str], timeframe: str, geo: str):
        return self._call(
            f"over_time {geo or GEO} {terms}",
            dict(kw_list=terms, timeframe=timeframe, geo=geo or GEO),
            lambda: self.pytrends.interest_over_time(),
        )

    def interest_by_region(self, terms: list[str], timeframe: str):
        return self._call(
            f"by_region {terms} [{timeframe}]",
            dict(kw_list=terms, timeframe=timeframe, geo=GEO),
            lambda: self.pytrends.interest_by_region(
                resolution="REGION", inc_low_vol=True, inc_geo_code=False),
        )

    def rising_queries(self, term: str, geo: str, timeframe: str):
        def extract():
            data = self.pytrends.related_queries()
            entry = data.get(term) or {}
            return entry.get("rising")
        return self._call(f"rising {term} {geo or GEO}",
                          dict(kw_list=[term], timeframe=timeframe, geo=geo or GEO),
                          extract)


def anchor_rescale(frames: list, batches: list[list[str]]) -> dict:
    """Merge per-batch results into one term -> series/level dict.

    Each batch is rescaled so its ANCHOR_TERM matches the first batch's, which
    makes values from separate requests comparable.
    """
    merged: dict = {}
    reference = None
    for frame, terms in zip(frames, batches):
        if frame is None or frame.empty:
            continue
        anchor_mean = float(frame[ANCHOR_TERM].mean()) if ANCHOR_TERM in frame else 0.0
        if reference is None:
            reference = anchor_mean or 1.0
        factor = (reference / anchor_mean) if anchor_mean > 0 else 1.0
        for term in terms:
            if term in merged or term not in frame:
                continue
            merged[term] = frame[term].astype(float) * factor
    return merged


# --------------------------------------------------------------------------
# Fetch stages
# --------------------------------------------------------------------------
def fetch_national_weekly(f: Fetcher, timeframe: str, batches: list[list[str]]):
    """Measured: national weekly interest per term over the window."""
    f.log(f"national weekly series, {len(batches)} batch(es)")
    frames = []
    for terms in batches:
        df = f.interest_over_time(terms, timeframe, GEO)
        if df is not None and not df.empty and "isPartial" in df:
            df = df[df["isPartial"] == False].drop(columns=["isPartial"])  # noqa: E712
        frames.append(df)
    merged = anchor_rescale(frames, batches)
    if not merged:
        raise RuntimeError("no national weekly data returned")

    index = next(iter(merged.values())).index
    weeks = [d.date().isoformat() for d in index]
    per_week = [{term: float(series.iloc[i]) for term, series in merged.items()}
                for i in range(len(index))]
    return weeks, per_week


def fetch_regional(f: Fetcher, timeframe: str, batches: list[list[str]], label: str):
    """Measured: per-state interest per term over the given window."""
    f.log(f"regional breakdown [{label}], {len(batches)} batch(es)")
    frames = []
    for terms in batches:
        frames.append(f.interest_by_region(terms, timeframe))
    merged = anchor_rescale(frames, batches)
    if not merged:
        raise RuntimeError(f"no regional data returned for {label}")

    out: dict[str, dict[str, float]] = {}
    unmatched: list[str] = []
    for region_name in next(iter(merged.values())).index:
        code = resolve_state_code(region_name)
        if code is None:
            unmatched.append(str(region_name))
            continue
        scores = {term: float(series.loc[region_name])
                  for term, series in merged.items() if region_name in series.index}
        if scores:
            out[code] = scores
    if unmatched:
        f.log(f"warning: unrecognised regions ignored: {', '.join(sorted(set(unmatched)))}")
    missing = {c for c, *_ in STATES} - set(out)
    if missing:
        f.log(f"warning: no regional data for {', '.join(sorted(missing))} (will use national level)")
    return out


def fetch_state_history(f: Fetcher, timeframe: str, batches: list[list[str]],
                        national_weeks: list[str]) -> dict[str, list[float]]:
    """Measured: one weekly series per state (slow path, geo=IN-XX)."""
    f.log(f"per-state weekly history: {len(STATES)} states x {len(batches)} batch(es) "
          f"-- this is the slow, rate-limit-prone path")
    out: dict[str, list[float]] = {}
    for n, (code, name, iso, *_rest) in enumerate(STATES, 1):
        try:
            frames = [f.interest_over_time(terms, timeframe, iso) for terms in batches]
            for i, df in enumerate(frames):
                if df is not None and not df.empty and "isPartial" in df:
                    frames[i] = df[df["isPartial"] == False].drop(columns=["isPartial"])  # noqa: E712
            merged = anchor_rescale(frames, batches)
            if not merged:
                raise RuntimeError("empty")
            length = len(next(iter(merged.values())))
            out[code] = [composite({t: float(s.iloc[i]) for t, s in merged.items()})
                         for i in range(length)]
            f.log(f"  {n:>2}/{len(STATES)} {name}: {len(out[code])} weeks")
        except Exception as exc:                     # noqa: BLE001
            f.log(f"  {n:>2}/{len(STATES)} {name}: FAILED ({exc}) -- will fall back to modelled")
    return out


def fetch_rising(f: Fetcher, timeframe: str, geo: str) -> list[dict]:
    """Measured: rising related queries, merged across all tracked terms."""
    rows: list[dict] = []
    for term in TERMS:
        try:
            df = f.rising_queries(term, geo, timeframe)
        except Exception:                            # noqa: BLE001
            continue
        if df is None or getattr(df, "empty", True):
            continue
        for _, row in df.head(4).iterrows():
            value = int(row["value"])
            rows.append({
                "query": str(row["query"]),
                "plain": prettify_query(row["query"]),
                "value": value,
                "formatted": "Breakout" if value >= 5000 else f"+{value}%",
            })
    rows.sort(key=lambda r: -r["value"])
    seen, unique = set(), []
    for r in rows:
        if r["query"] in seen:
            continue
        seen.add(r["query"])
        unique.append(r)
    return unique[:4]


# --------------------------------------------------------------------------
# Assembly
# --------------------------------------------------------------------------
def model_state_history(national_raw: list[float], level_12m: float, level_now: float) -> list[float]:
    """Derive a state's weekly series from the national shape.

    Scales the national curve to the state's measured 12-month level, then pins
    the final weeks to the state's measured current level so both real readings
    survive. Used only in --history modeled.
    """
    nat_mean = sum(national_raw) / max(len(national_raw), 1) or 1.0
    scaled = [v * (level_12m / nat_mean) for v in national_raw]
    if not scaled:
        return scaled
    # Blend the tail toward the measured current level over the last ~6 weeks.
    gap = level_now - scaled[-1]
    n = len(scaled)
    for i in range(n):
        weight = max(0.0, 1.0 - (n - 1 - i) / 6.0)
        scaled[i] += gap * weight
    return scaled


def build_payload(args) -> dict:
    batches = build_batches()
    f = Fetcher(tries=args.tries, base_sleep=args.sleep)

    weeks, national_per_week = fetch_national_weekly(f, args.timeframe, batches)
    national_raw = [composite(scores) for scores in national_per_week]

    regional_12m = fetch_regional(f, args.timeframe, batches, args.timeframe)
    regional_now = fetch_regional(f, "now 7-d", batches, "now 7-d")

    national_level = sum(national_raw) / len(national_raw)

    per_state_history: dict[str, list[float]] = {}
    if args.history == "per-state":
        per_state_history = fetch_state_history(f, args.timeframe, batches, weeks)

    # Rising queries.
    rising_national: list[dict] = []
    rising_by_state: dict[str, list[dict]] = {}
    if args.rising == "national":
        f.log("rising queries (national, applied to every state)")
        rising_national = fetch_rising(f, args.timeframe, GEO)
    elif args.rising == "per-state":
        f.log("rising queries per state -- slow path")
        for code, name, iso, *_rest in STATES:
            rising_by_state[code] = fetch_rising(f, args.timeframe, iso)
            f.log(f"  {name}: {len(rising_by_state[code])} rising queries")

    # Raw series per state, before the shared rescale.
    raw: dict[str, list[float]] = {}
    modelled_fallbacks = 0
    for code, _name, _iso, *_rest in STATES:
        measured = per_state_history.get(code)
        if measured and len(measured) == len(weeks):
            raw[code] = measured
            continue
        if args.history == "per-state":
            modelled_fallbacks += 1
        level_12m = composite(regional_12m.get(code, {})) or national_level
        level_now = composite(regional_now.get(code, {})) or level_12m
        raw[code] = model_state_history(national_raw, level_12m, level_now)

    rescale = make_rescaler([v for series in raw.values() for v in series])

    states_out = []
    for code, name, iso, *_rest in STATES:
        series = [rescale(v) for v in raw[code]]
        now_scores = regional_now.get(code) or regional_12m.get(code) or {}
        # Per-term scores are reported on the same 0-100 footing as the index.
        term_scores = {t: clamp_int(now_scores.get(t, series[-1])) for t in TERMS}
        states_out.append(summarize_state(
            code, name, iso, weeks, series, term_scores,
            rising_by_state.get(code, rising_national),
        ))
    states_out.sort(key=lambda s: s["name"])

    history_mode = "per-state" if (args.history == "per-state" and per_state_history) \
        else "modeled-from-national"

    notes = [
        "Google Trends values are relative search interest, not search counts. "
        "100 marks the busiest observed point, not a number of people.",
        "All figures are aggregated by region and anonymized at source; Google "
        "Trends exposes no individual-level data.",
        "Internet and smartphone access is uneven across Indian states, and the "
        "language people search in varies by region, so states are not equally "
        "represented in this signal.",
    ]
    if history_mode == "modeled-from-national":
        notes.append(
            "Per-state 12-month history is DERIVED, not measured: the measured "
            "national weekly shape is scaled to each state's measured 12-month "
            "level and pinned to its measured current level. Re-run with "
            "--history per-state for fully measured state histories.")
    if modelled_fallbacks:
        notes.append(f"{modelled_fallbacks} state(s) fell back to a derived history "
                     f"after their per-state request failed.")
    if args.rising == "national":
        notes.append("Rising queries are national and shown for every state; "
                     "re-run with --rising per-state for state-level queries.")
    elif args.rising == "none":
        notes.append("Rising-query collection was skipped for this run.")

    return {
        "meta": {
            "schema_version": SCHEMA_VERSION,
            "generated_at": datetime.now(timezone.utc).replace(microsecond=0)
                                    .isoformat().replace("+00:00", "Z"),
            "source": "google-trends",
            "is_synthetic": False,
            "source_label": "Google Trends",
            "data_notice": (
                "Aggregated, anonymized public search-interest data from Google "
                "Trends for India. Values are relative search interest by region, "
                "not counts of people and not a clinical measurement."
            ),
            "history_mode": history_mode,
            "notes": notes,
            "geo": GEO,
            "terms": TERMS,
            "term_labels": TERM_LABELS,
            "term_weights": TERM_WEIGHTS,
            "timeframe": {
                "start": weeks[0],
                "end": weeks[-1],
                "weeks": len(weeks),
                "resolution": "weekly",
            },
            "storm_index": {"definition": STORM_INDEX_DEFINITION, "tiers": TIERS},
            "fetch": {
                "timeframe_query": args.timeframe,
                "requests_made": f.requests_made,
                "history_option": args.history,
                "rising_option": args.rising,
            },
        },
        "national": summarize_national(weeks, states_out),
        "states": states_out,
    }


def main() -> None:
    default_out = Path(__file__).resolve().parent / "trends_data.json"
    ap = argparse.ArgumentParser(
        description="Fetch real Google Trends data for India (optional; the app ships with synthetic data).")
    ap.add_argument("--timeframe", default="today 12-m", help="Trends timeframe (default: 'today 12-m')")
    ap.add_argument("--history", choices=("modeled", "per-state"), default="modeled",
                    help="per-state weekly history: derived from the national shape (fast, default) "
                         "or measured per state (slow, rate-limit prone)")
    ap.add_argument("--rising", choices=("national", "per-state", "none"), default="national",
                    help="how to collect rising related queries (default: national)")
    ap.add_argument("--tries", type=int, default=5, help="attempts per request (default: 5)")
    ap.add_argument("--sleep", type=float, default=2.0,
                    help="seconds to pause before each request (default: 2.0)")
    ap.add_argument("--out", type=Path, default=default_out, help="output path")
    args = ap.parse_args()

    print("[trends] Google Trends is an unofficial, rate-limited endpoint.")
    print("[trends] If this fails, the existing dataset is left untouched.\n")

    try:
        payload = build_payload(args)
    except Exception as exc:                         # noqa: BLE001
        print(f"\n[trends] FETCH FAILED: {type(exc).__name__}: {exc}")
        print(f"[trends] {args.out} was NOT modified.")
        print("[trends] The app still works -- it ships with synthetic data.")
        print("[trends] To regenerate that: python3 data/generate_mock_data.py")
        sys.exit(1)

    problems = validate(payload)
    if problems:
        print(f"\n[trends] fetched data failed schema validation ({len(problems)} problem(s)):")
        for p in problems:
            print(f"  - {p}")
        print(f"[trends] {args.out} was NOT modified.")
        sys.exit(1)

    args.out.write_text(json.dumps(payload, indent=1), encoding="utf-8")
    nat = payload["national"]["current"]
    print(f"\n[trends] wrote {args.out} ({args.out.stat().st_size / 1024:.0f} KB)")
    print(f"[trends] REAL DATA from Google Trends -- history_mode={payload['meta']['history_mode']}")
    print(f"[trends] window {payload['meta']['timeframe']['start']} -> {payload['meta']['timeframe']['end']}")
    print(f"[trends] national index {nat['storm_index']} ({nat['tier']}), "
          f"{payload['national']['states_under_storm_watch']} states under storm watch")
    print("[trends] Reload the app -- no code change needed.")


if __name__ == "__main__":
    main()
