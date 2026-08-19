# Agent Execution Plan: Mental Health Weather Map

**Status:** Complete
**Goal:** Build a data-driven React application that visualizes mental health search trends across India using a severe weather metaphor.

## Phase 1: Frontend Scaffold & Metaphor
- [x] Initialize React + Vite project (`npm create vite@latest`)
- [x] Create India SVG map component with state-level paths
- [x] Implement "Storm Index" tiering logic (Clear -> Cloudburst)
- [x] Build sidebar layout to show regional breakdowns
- [x] Hardcode synthetic mock data for initial UI testing

## Phase 2: Interactivity
- [x] Build `TimeScrubber.jsx` component
- [x] Wire up the 52-week array to the scrubber state
- [x] Implement `setInterval` for the automatic Replay feature
- [x] Ensure map dynamically recolors based on selected week

## Phase 3: Live Data Pipeline (Google Trends)
- [x] Write `data/fetch_trends.py` 
- [x] Use `pytrends` to fetch search interest for target keywords
- [x] Map Google Trends region strings to ISO-3166-2:IN state codes
- [x] Implement anchor-rescaling to normalize data across batches
- [x] Export final structured JSON

## Phase 4: Pivot (Rate Limit Mitigation)
- [x] *ISSUE*: Google Trends API is strictly rate-limiting the `fetch_trends.py` script.
- [x] *SOLUTION*: Accept manually downloaded Google Trends CSVs from user.
- [x] Write `data/parse_manual_csvs.py` to ingest 4 raw CSV files
- [x] Replicate scaling and normalization logic from the original script
- [x] Successfully generate `trends_data.json` from manual CSVs

## Phase 5: Edge Case Debugging
- [x] *ISSUE*: UI is displaying flat '69' data for Ladakh across all terms.
- [x] *RCA (Root Cause Analysis)*: Google Trends returned no data for Ladakh due to low search volume. Script is falling back to national average.
- [x] *FIX*: Create `STATE_FALLBACKS` dictionary in `schema.py`.
- [x] *FIX*: Route missing data for Ladakh to Jammu & Kashmir, Lakshadweep to Kerala, etc.
- [x] Re-run `parse_manual_csvs.py` and verify UI.
