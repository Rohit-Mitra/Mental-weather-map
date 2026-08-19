# Mega-Prompt for Presentation Generation

**Instructions:** 
Copy everything below the line and paste it into an AI like ChatGPT, Claude, or Gemini. It contains all the context needed to generate a perfect PowerPoint presentation about your project.

---

**Act as an expert Presentation Designer and Technical Storyteller.**

I need to create a PowerPoint presentation about a project I recently built called the **"Mental Health Weather Map — India"**. 

The main theme of this presentation is **"Vibe Coding"** — demonstrating how I acted as a Product Manager and used AI agents to rapidly build, debug, and deploy a complex data-visualization application using natural language.

Please generate a detailed, slide-by-slide outline for a 10-15 minute presentation. For each slide, provide:
1. The Slide Title
2. The Visuals/Images I should include
3. The Bullet Points (keep them concise)
4. The Speaker Notes (what I should actually say to the audience)

### Context 1: What the App Is (The BRD)
- **Product Vision:** A data visualization dashboard designed to track public search trends related to stress and anxiety across India. By treating anonymized Google Trends data as a metaphorical "weather system," the dashboard provides an intuitive, non-clinical overview of a population's collective mental health over time. 
- **Core Concept:** Use search trends (e.g., "anxiety symptoms", "panic attack", "burnout") to calculate a "Storm Index" (0-100).
- **Design Metaphor:** Tiers like Clear, Hazy, Overcast, Storm, Cloudburst.
- **Tech Stack Requirements:** React + Vite for frontend, Python (Pandas) for data processing.
- **Key Features:** Interactive SVG map of India, 12-month time scrubber, regional fallbacks for missing data.

### Context 2: How I Built It (The Vibe Coding Process)
I built this by iteratively prompting an AI agent. Here is the exact progression of how it was built:
- **Phase 1 (The Vision):** I prompted the AI to build a React app that looks like a severe weather dashboard, but tracking mental health trends instead of rain.
- **Phase 2 (Interactivity):** I instructed the AI to add a 'Time Scrubber' slider across a 52-week timeframe to watch how the 'storms' build and move.
- **Phase 3 (Data Pipeline):** I had the AI write a Python script using `pytrends` to fetch real data from Google Trends.
- **Phase 4 (The Pivot/Debugging):** The Google Trends API aggressively rate-limited my IP. Instead of giving up, I manually downloaded CSVs from Google Trends, and prompted the AI to write a completely new custom parsing script (`parse_manual_csvs.py`) to format my raw CSVs into the exact JSON structure the React app required.
- **Phase 5 (Edge Cases):** We discovered a bug where regions with low internet penetration (like Ladakh) were missing from the CSVs, causing flat-line data. I prompted the AI to implement a geographical fallback system, gracefully mapping Ladakh's missing data to neighboring Jammu & Kashmir.

### Presentation Goals:
- Start with the "Why" (Mental health is hard to visualize, weather is universally understood).
- Show the final product (Screenshots of the app).
- Emphasize the "Vibe Coding" journey (How I steered the AI through architectural decisions, API roadblocks, and edge-case debugging).
- **CRITICAL:** Include a dedicated slide showing the `agent_task_list.md` (a markdown checklist we used to track our 5-phase execution plan) to visually prove how an AI agent breaks down a vague prompt into an iterative, actionable engineering checklist.
- End with key takeaways on how AI is changing software development.

Please generate the slide deck outline!
