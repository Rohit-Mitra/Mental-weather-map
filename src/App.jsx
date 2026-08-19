import React, { useCallback, useEffect, useMemo, useState } from 'react';

import AboutModal from './components/AboutModal.jsx';
import Disclaimer from './components/Disclaimer.jsx';
import Masthead from './components/Masthead.jsx';
import StateDetailPanel from './components/StateDetailPanel.jsx';
import Ticker from './components/Ticker.jsx';
import TodayBoard from './components/TodayBoard.jsx';
import TimeScrubber from './components/TimeScrubber.jsx';
import Tooltip from './components/Tooltip.jsx';
import ViewToggle from './components/ViewToggle.jsx';
import WarningLadder from './components/WarningLadder.jsx';
import WeatherMap from './components/WeatherMap.jsx';

import geo from './data/india-states-paths.json';
import { useTrendsData } from './lib/useTrendsData.js';
import { buildTicker, headline, nationalAt, readingAt, termMeans } from './lib/narrative.js';
import { tierFor } from './lib/stormIndex.js';

/** Geometry is keyed by state code; joined to the dataset at render time. */
const GEO_BY_CODE = Object.fromEntries(geo.states.map((s) => [s.code, s]));

function Dashboard({ data, loadedFrom }) {
  const weeks = useMemo(() => data.states[0].history.map((h) => h.week), [data]);
  const lastIndex = weeks.length - 1;

  const [viewMode, setViewMode] = useState('current');
  const [weekIndex, setWeekIndex] = useState(lastIndex);
  const [playing, setPlaying] = useState(false);
  const [selectedCode, setSelectedCode] = useState(null);
  const [hover, setHover] = useState(null);
  const [aboutOpen, setAboutOpen] = useState(false);

  // Replay only makes sense against weekly conditions, not a yearly average.
  const scrubDisabled = viewMode === 'outlook';
  useEffect(() => {
    if (scrubDisabled && playing) setPlaying(false);
  }, [scrubDisabled, playing]);

  /** One row per state: geometry joined to the reading for the current view. */
  const rows = useMemo(
    () =>
      data.states
        .map((state) => {
          const shape = GEO_BY_CODE[state.code];
          if (!shape) return null;
          const { index } = readingAt(state, viewMode, weekIndex);
          const tier = tierFor(index);
          return {
            code: state.code,
            name: state.name,
            d: shape.d,
            centroid: shape.centroid,
            bounds: shape.bounds,
            area: shape.area,
            index,
            tier: tier.key,
            tierLabel: tier.label,
            tierLevel: tier.level,
            state,
          };
        })
        .filter(Boolean),
    [data, viewMode, weekIndex],
  );

  const byCode = useMemo(() => Object.fromEntries(rows.map((r) => [r.code, r])), [rows]);

  const tierCounts = useMemo(() => {
    const counts = {};
    rows.forEach((r) => {
      counts[r.tier] = (counts[r.tier] ?? 0) + 1;
    });
    return counts;
  }, [rows]);

  const means = useMemo(() => termMeans(data), [data]);
  const tickerItems = useMemo(() => buildTicker(data, viewMode, weekIndex), [data, viewMode, weekIndex]);
  const tagline = useMemo(() => headline(data, viewMode, weekIndex), [data, viewMode, weekIndex]);

  const nationalIndex = nationalAt(data, viewMode, weekIndex);
  const nationalDelta =
    viewMode === 'outlook'
      ? 0
      : nationalIndex - (data.national.history[weekIndex - 1]?.storm_index ?? nationalIndex);

  const handleHover = useCallback(
    (code, event) => {
      if (!code) {
        setHover(null);
        return;
      }
      const row = byCode[code];
      if (!row) return;
      // Keyboard focus events carry no coordinates; fall back to the shape.
      let { clientX: x, clientY: y } = event ?? {};
      if (!x && !y && event?.currentTarget?.getBoundingClientRect) {
        const rect = event.currentTarget.getBoundingClientRect();
        x = rect.left + rect.width / 2;
        y = rect.top + rect.height / 2;
      }
      setHover({ code, name: row.name, index: row.index, x: x ?? 0, y: y ?? 0 });
    },
    [byCode],
  );

  const handleSelect = useCallback((code) => {
    setSelectedCode((prev) => (prev === code ? prev : code));
  }, []);

  const selectedState = selectedCode ? byCode[selectedCode]?.state : null;

  return (
    <div className={`app ${selectedState ? 'has-panel' : ''}`}>
      <div className="sky" aria-hidden="true">
        <span className="sky__glow sky__glow--a" />
        <span className="sky__glow sky__glow--b" />
      </div>

      <Masthead
        headline={tagline}
        week={weeks[weekIndex]}
        isSynthetic={Boolean(data.meta.is_synthetic)}
        sourceLabel={data.meta.source_label}
        onAbout={() => setAboutOpen(true)}
      />

      <aside className="rail">
        <WarningLadder
          counts={tierCounts}
          nationalIndex={nationalIndex}
          nationalDelta={nationalDelta}
          total={rows.length}
          viewMode={viewMode}
        />
      </aside>

      <main className="stage">
        <div className="stage__controls">
          <ViewToggle value={viewMode} onChange={setViewMode} />
        </div>

        <div className="stage__map">
          <WeatherMap
            geo={geo}
            rows={rows}
            selectedCode={selectedCode}
            hoveredCode={hover?.code ?? null}
            onSelect={handleSelect}
            onHover={handleHover}
            viewLabel={viewMode === 'outlook' ? '12-month outlook' : 'current conditions'}
          />
        </div>
      </main>

      <aside className="aside">
        {selectedState ? (
          <StateDetailPanel
            data={data}
            state={selectedState}
            viewMode={viewMode}
            weekIndex={weekIndex}
            termMeans={means}
            onClose={() => setSelectedCode(null)}
          />
        ) : (
          <TodayBoard
            data={data}
            viewMode={viewMode}
            weekIndex={weekIndex}
            onSelect={handleSelect}
          />
        )}
      </aside>

      <TimeScrubber
        weeks={weeks}
        value={weekIndex}
        onChange={setWeekIndex}
        playing={playing}
        onTogglePlay={() => setPlaying((p) => !p)}
        disabled={scrubDisabled}
      />

      <Ticker items={tickerItems} />
      <Disclaimer onAbout={() => setAboutOpen(true)} />

      <Tooltip hover={hover} />

      {aboutOpen && (
        <AboutModal meta={data.meta} loadedFrom={loadedFrom} onClose={() => setAboutOpen(false)} />
      )}
    </div>
  );
}

export default function App() {
  const result = useTrendsData();

  if (result.status === 'loading') {
    return (
      <div className="boot">
        <div className="boot__spinner" aria-hidden="true" />
        <p>Reading the bulletin…</p>
      </div>
    );
  }

  if (result.status === 'error') {
    return (
      <div className="boot boot--error">
        <h1>Could not load the bulletin data</h1>
        <p>
          The app expects <code>data/trends_data.json</code>. Generate it with:
        </p>
        <pre>python3 data/generate_mock_data.py</pre>
        <p className="boot__detail">{String(result.error)}</p>
      </div>
    );
  }

  return <Dashboard data={result.data} loadedFrom={result.loadedFrom} />;
}
