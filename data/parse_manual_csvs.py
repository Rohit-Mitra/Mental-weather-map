import pandas as pd
import json
from pathlib import Path
from datetime import datetime, timezone
import sys

# Add data dir to path so we can import schema
sys.path.insert(0, str(Path(__file__).parent))

from schema import (
    STATES, TERMS, TERM_LABELS, TERM_WEIGHTS, TIERS,
    STORM_INDEX_DEFINITION, SCHEMA_VERSION,
    resolve_state_code, composite, make_rescaler, clamp_int, summarize_state, summarize_national
)
from fetch_trends import anchor_rescale, model_state_history, ANCHOR_TERM, GEO

def load_clean_csv(path, index_col):
    # Google Trends sometimes includes a row at the top or bottom that needs cleaning
    df = pd.read_csv(path, index_col=index_col, skiprows=1 if 'Category' in open(path).readline() else 0)
    # Replace '<1' with '0'
    df = df.replace('<1', '0')
    # Drop rows that are NaNs
    df = df.dropna()
    # Convert all columns to float
    for col in df.columns:
        if col in TERMS:
            df[col] = df[col].astype(float)
    if index_col == "Time":
        df.index = pd.to_datetime(df.index)
    return df

def main():
    base_dir = Path(__file__).parent
    
    print("Loading manual CSVs...")
    nat_frames = [
        load_clean_csv(base_dir / "trends_csv" / "national_timeline_1.csv", "Time"),
        load_clean_csv(base_dir / "trends_csv" / "national_timeline_2.csv", "Time")
    ]
    reg_frames = [
        load_clean_csv(base_dir / "trends_csv" / "regional_map_1.csv", "Region"),
        load_clean_csv(base_dir / "trends_csv" / "regional_map_2.csv", "Region")
    ]
    
    batches = [
        list(nat_frames[0].columns),
        list(nat_frames[1].columns)
    ]
    
    print("Merging data...")
    # Merge national
    merged_nat = anchor_rescale(nat_frames, batches)
    index = next(iter(merged_nat.values())).index
    weeks = [d.date().isoformat() for d in index]
    national_raw = [
        composite({term: float(series.iloc[i]) for term, series in merged_nat.items()})
        for i in range(len(index))
    ]
    national_level = float(pd.Series(national_raw).mean())
    
    # Merge regional
    merged_reg = anchor_rescale(reg_frames, batches)
    regional_12m = {}
    for region_name in next(iter(merged_reg.values())).index:
        code = resolve_state_code(region_name)
        if code:
            regional_12m[code] = {
                term: float(series.loc[region_name])
                for term, series in merged_reg.items() if region_name in series.index
            }
    
    # We didn't download 7-day regional. Use 12m for level_now so we don't break the model
    regional_now = regional_12m
    
    from schema import STATE_FALLBACKS
    
    raw = {}
    for code, _name, _iso, *_rest in STATES:
        fallback_code = STATE_FALLBACKS.get(code, code) if code not in regional_12m else code
        fallback_now_code = STATE_FALLBACKS.get(code, code) if code not in regional_now else code
        
        level_12m = composite(regional_12m.get(fallback_code, {})) or national_level
        level_now = composite(regional_now.get(fallback_now_code, {})) or level_12m
        raw[code] = model_state_history(national_raw, level_12m, level_now)
        
    rescale = make_rescaler([v for series in raw.values() for v in series])
    
    print("Building final payload...")
    states_out = []
    for code, name, iso, *_rest in STATES:
        series = [rescale(v) for v in raw[code]]
        
        fallback_code = STATE_FALLBACKS.get(code, code) if code not in regional_12m else code
        fallback_now_code = STATE_FALLBACKS.get(code, code) if code not in regional_now else code
        
        now_scores = regional_now.get(fallback_now_code) or regional_12m.get(fallback_code) or {}
        term_scores = {t: clamp_int(now_scores.get(t, series[-1])) for t in TERMS}
        states_out.append(summarize_state(
            code, name, iso, weeks, series, term_scores,
            [] # No rising queries for manual
        ))
    states_out.sort(key=lambda s: s["name"])
    
    payload = {
        "meta": {
            "schema_version": SCHEMA_VERSION,
            "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
            "source": "google-trends-manual",
            "is_synthetic": False,
            "source_label": "Google Trends (Manual CSV)",
            "data_notice": "Manual CSV export from Google Trends.",
            "history_mode": "modeled-from-national (manual)",
            "notes": ["Manual offline generation from CSVs"],
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
                "timeframe_query": "manual",
                "requests_made": 0,
                "history_option": "modeled",
                "rising_option": "none",
            },
        },
        "national": summarize_national(weeks, states_out),
        "states": states_out,
    }
    
    out_path = base_dir / "trends_data.json"
    out_path.write_text(json.dumps(payload, indent=1), encoding="utf-8")
    print(f"Successfully generated {out_path} from manual CSVs.")

if __name__ == "__main__":
    main()
