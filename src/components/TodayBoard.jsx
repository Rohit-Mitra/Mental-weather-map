/**
 * What fills the right-hand column when no state is selected.
 *
 * India is a portrait shape on a landscape screen, so a centred map leaves a
 * column of dead space. Rather than stretch the map or pad it out, that column
 * carries the two questions a viewer asks straight after "what does the map
 * look like": where is it loudest, and what changed this week. Both are
 * clickable, so the board doubles as a way into the map for anyone who does not
 * know Indian state shapes.
 */
import React, { useMemo } from 'react';
import TrendChart from './TrendChart.jsx';
import { TIER_ACCENT, colorFor, tierFor } from '../lib/stormIndex.js';
import { readingAt } from '../lib/narrative.js';

function Row({ rank, name, index, delta, onSelect, showDelta }) {
  return (
    <li className="board__row">
      <button type="button" onClick={onSelect} className="board__btn">
        <span className="board__rank">{rank ?? ''}</span>
        <span className="board__name">{name}</span>
        {showDelta ? (
          <span className="board__pair">
            <span className={`board__delta ${delta > 0 ? 'is-up' : 'is-down'}`}>
              {delta > 0 ? '+' : '−'}
              {Math.abs(delta)}
            </span>
            <span className="board__to" style={{ color: colorFor(index) }}>
              to {index}
            </span>
          </span>
        ) : (
          <span className="board__value" style={{ color: colorFor(index) }}>
            {index}
          </span>
        )}
        {/* The bar encodes the index. It is omitted on the movers list, where
            the number beside it is a change — one bar cannot mean both. */}
        {!showDelta && (
          <span className="board__bar" aria-hidden="true">
            <i style={{ width: `${index}%`, background: colorFor(index) }} />
          </span>
        )}
      </button>
    </li>
  );
}

export default function TodayBoard({ data, viewMode, weekIndex, onSelect }) {
  const readings = useMemo(
    () =>
      data.states
        .map((s) => ({ state: s, ...readingAt(s, viewMode, weekIndex) }))
        .sort((a, b) => b.index - a.index),
    [data, viewMode, weekIndex],
  );

  const highest = readings.slice(0, 5);
  const movers = useMemo(() => {
    if (viewMode === 'outlook') return [];
    const sorted = [...readings].sort((a, b) => b.delta - a.delta);
    const up = sorted.filter((r) => r.delta > 0).slice(0, 2);
    const down = sorted.filter((r) => r.delta < 0).slice(-2).reverse();
    return [...up, ...down];
  }, [readings, viewMode]);

  const nationalTier = tierFor(data.national.current.storm_index);

  return (
    <div className="board">
      <section className="board__section">
        <h2 className="panel__h3">
          {viewMode === 'outlook' ? 'Highest 12-month average' : 'Loudest today'}
        </h2>
        <p className="panel__hint">Search interest for the tracked terms, 0–100.</p>
        <ol className="board__list">
          {highest.map((r, i) => (
            <Row
              key={r.state.code}
              rank={i + 1}
              name={r.state.name}
              index={r.index}
              onSelect={() => onSelect(r.state.code)}
            />
          ))}
        </ol>
      </section>

      {movers.length > 0 && (
        <section className="board__section">
          <h2 className="panel__h3">Biggest movers this week</h2>
          <p className="panel__hint">Change against the week before.</p>
          <ol className="board__list">
            {movers.map((r) => (
              <Row
                key={r.state.code}
                name={r.state.name}
                index={r.index}
                delta={r.delta}
                showDelta
                onSelect={() => onSelect(r.state.code)}
              />
            ))}
          </ol>
        </section>
      )}

      <section className="board__section">
        <h2 className="panel__h3">All-India, last 12 months</h2>
        <p className="panel__hint">
          The exam calendar and the monsoon are both visible in this line.
        </p>
        <TrendChart
          history={data.national.history}
          markerIndex={weekIndex}
          accent={TIER_ACCENT[nationalTier.key]}
        />
      </section>

      <p className="board__hint">Select a state on the map for its full forecast.</p>
    </div>
  );
}
