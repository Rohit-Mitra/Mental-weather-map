/**
 * The warning ladder — the instrument this bulletin is read off.
 *
 * It does three jobs at once, which is why it earns the whole left rail:
 *   1. it is the legend, naming each band and what it means;
 *   2. it is a histogram, showing how many states sit in each band right now;
 *   3. it is a gauge, with the all-India reading pinned at its true height.
 *
 * Band heights are proportional to their share of the 0-100 scale, so the
 * ladder is a real scale rather than five equal swatches — the eye can read
 * "most of the country is in a band that covers a quarter of the range".
 *
 * Colour codes follow the India Meteorological Department's warning ladder,
 * which is the vocabulary an Indian audience already reads off a monsoon
 * bulletin: Green, Yellow, Orange, Red.
 */
import React from 'react';
import WeatherIcon from './WeatherIcon.jsx';
import { TIERS, colorFor, tierFor } from '../lib/stormIndex.js';

// Gradient stops sampled off the same ramp the map uses, so the scale bar and
// the states are painted from one source of truth.
const SCALE_GRADIENT = `linear-gradient(to top, ${[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
  .map((v) => `${colorFor(v)} ${v}%`)
  .join(', ')})`;

export default function WarningLadder({ counts, nationalIndex, nationalDelta, total, viewMode }) {
  const descending = [...TIERS].reverse();
  const nationalTier = tierFor(nationalIndex);

  return (
    <div className="ladder">
      <section className="reading">
        <h2 className="rail__h">All-India index</h2>
        <div className="reading__row">
          <span className="reading__value" style={{ color: colorFor(nationalIndex) }}>
            {nationalIndex}
          </span>
          <span className="reading__meta">
            <WeatherIcon tier={nationalTier.key} size={22} />
            <span className="reading__level">{nationalTier.level}</span>
            <span className="reading__band">{nationalTier.label}</span>
          </span>
        </div>
        <p className="reading__delta">
          {viewMode === 'outlook' ? (
            'Average of the last 52 weeks'
          ) : (
            <>
              {nationalDelta === 0
                ? 'Unchanged on last week'
                : `${nationalDelta > 0 ? 'Up' : 'Down'} ${Math.abs(nationalDelta)} on last week`}
            </>
          )}
        </p>
      </section>

      <section className="ladder__body">
        <h2 className="rail__h">Warning ladder</h2>
        <p className="rail__lede">
          Higher means more searching for stress and anxiety terms than usual.
        </p>

        <div className="ladder__grid">
          <div className="ladder__gauge">
            <div className="ladder__scale" style={{ background: SCALE_GRADIENT }} aria-hidden="true">
              {[20, 40, 65, 85].map((v) => (
                <span key={v} className="ladder__tick" style={{ bottom: `${v}%` }} />
              ))}
            </div>
            <span
              className="ladder__pin"
              style={{ bottom: `${nationalIndex}%` }}
              aria-hidden="true"
            >
              <span className="ladder__pin-label">All-India</span>
            </span>
          </div>

          <ol className="ladder__rows">
            {descending.map((tier) => {
              const count = counts[tier.key] ?? 0;
              return (
                <li
                  key={tier.key}
                  className={`rung rung--${tier.key} ${count === 0 ? 'is-empty' : ''}`}
                  style={{ flexGrow: tier.max - tier.min + 1 }}
                >
                  <span className="rung__label">{tier.label}</span>
                  <span className="rung__count">{count}</span>
                  <span className="rung__meta" style={{ color: colorFor((tier.min + tier.max) / 2) }}>
                    {tier.code} · {tier.level}
                  </span>
                  <span className="rung__range">
                    {tier.min}–{tier.max}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        <p className="ladder__note">
          Bands follow the India Meteorological Department’s warning colours. The
          number is search interest, not a count of people.
        </p>
      </section>
    </div>
  );
}
