# Business Requirements Document (BRD)
## Project Name: Mental Health Weather Map — India

### 1. Executive Summary
The Mental Health Weather Map is a data visualization dashboard designed to track public search trends related to stress and anxiety across India. By treating anonymized Google Trends data as a metaphorical "weather system," the dashboard provides an intuitive, non-clinical overview of a population's collective mental health over time. 

### 2. Objectives
- Develop an interactive map of India that visualizes search intensity for specific mental health-related terms.
- Provide both a historical 12-month outlook and a current (latest week) conditions view.
- Ensure the interface feels distinctly like a severe weather bulletin, utilizing appropriate terminology (e.g., "Storm Watch", "Cloudburst").

### 3. Core Features
- **Map Visualization**: An SVG-based map of India, broken down by states and union territories. 
- **Storm Index**: A proprietary 0-100 index aggregating multiple search terms. The index translates into visual tiers:
  - `Clear` (Green: 0-20)
  - `Hazy` (Light Green: 21-40)
  - `Overcast` (Yellow: 41-65)
  - `Storm` (Orange: 66-85)
  - `Cloudburst` (Red: 86-100)
- **Time Scrubber**: A playback control allowing users to drag through the last 52 weeks to watch "storms" build and cross the country.
- **Regional Breakdown**: The ability to select individual states to see specific metrics, 52-week peak history, and the primary terms driving the index in that region.

### 4. Data Requirements
**Tracked Terms:**
- `anxiety symptoms` (Anchor term)
- `panic attack`
- `can't sleep`
- `exam stress`
- `work stress`
- `burnout`
- `psychiatrist near me`
- `तनाव` (Stress in Hindi)

**Data Source:** 
Anonymized, relative search interest data sourced via Google Trends. 
*Constraint*: Due to strict rate limits on the Google Trends API, the application must support parsing manually downloaded CSV files. 
*Fallback Handling*: Regions with insufficient search volume (e.g., Ladakh, Lakshadweep) must inherit data from their nearest geographic neighbor to maintain map continuity.

### 5. Tech Stack
- **Frontend**: React (Vite)
- **Styling**: Standard CSS with a custom dark-themed color palette.
- **Data Pipeline**: Python (Pandas) for processing raw CSVs into a structured JSON payload (`trends_data.json`).
