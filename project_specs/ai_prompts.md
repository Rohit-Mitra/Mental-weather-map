# AI Prompt Log
*The following is a curated log of the prompts and iterative feedback provided to the AI agent to "vibe code" the Mental Health Weather Map application.*

---

### Prompt 1: The Initial Vision
> "I want to build a React application using Vite that visualizes mental health search trends across India. I want it to look exactly like a severe weather tracking dashboard. 
> Instead of tracking rain, it should track Google search interest for terms like 'anxiety symptoms', 'panic attack', and 'work stress'. Create a 0-100 'Storm Index' with tiers like 'Clear', 'Overcast', and 'Cloudburst'. Make sure the UI has an interactive SVG map of India, and an area on the right to show state-level breakdowns."

### Prompt 2: Adding Interactive History
> "This looks great, but right now it's static. Let's add a 'Time Scrubber' component at the bottom of the map. I want to be able to drag a slider across a 52-week timeframe to watch how the 'storms' build and move across the country over the last year. Give it a play/pause button that automatically loops through the weeks."

### Prompt 3: Building the Data Pipeline
> "We need to replace the synthetic mock data with real data. Write a Python script (`fetch_trends.py`) that uses the `pytrends` library to download the last 12 months of search interest for our terms. Make sure it fetches the national average, and then breaks it down by ISO-3166-2:IN state codes so it matches our map SVG. Output everything into a `trends_data.json` file."

### Prompt 4: Handling API Rate Limits
> "The `pytrends` library keeps crashing because Google Trends is strictly rate-limiting my IP. I can't run the fetch script successfully. 
> To bypass this, I've manually exported 4 CSV files from the Google Trends website myself and placed them in `data/trends_csv/`. Can you write a new script called `parse_manual_csvs.py` that reads these raw CSV files, merges their timelines, and formats them into the exact JSON structure our React app requires?"

### Prompt 5: Edge Cases and Data Integrity
> "The map is rendering the new manual CSV data, but there's a bug. The data for the state of Ladakh is literally showing as a flat '69' for every single term. 
> I realized this is because Google Trends doesn't have enough search volume for Ladakh, so it completely omits it from the CSV exports. Can you update the Python schema and parsing script so that if a state doesn't have enough data, it safely falls back to a neighboring state's data (like mapping Ladakh to Jammu & Kashmir) instead of defaulting to a flat national average?"
