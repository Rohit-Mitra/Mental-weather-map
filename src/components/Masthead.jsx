/**
 * The masthead, set as a bulletin header rather than an app bar.
 *
 * The metadata on the right is structural, not decorative: the bulletin number
 * really is which weekly reading of its year this is, and the issue date really
 * is the week the data covers. Both change when you scrub the replay.
 */
import React, { useEffect, useState } from 'react';
import { bulletinNumber, formatWeek } from '../lib/stormIndex.js';

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function Masthead({ headline, week, isSynthetic, sourceLabel, onAbout }) {
  const now = useClock();
  const bulletin = bulletinNumber(week);

  return (
    <header className="masthead">
      <div className="masthead__identity">
        <p className="masthead__eyebrow">Search-interest bulletin · India</p>
        <h1 className="masthead__title">
          Mental Health <span className="masthead__title-em">Weather Map</span>
        </h1>
        <p className="masthead__headline">{headline}</p>
      </div>

      <div className="masthead__meta">
        <dl className="stamp">
          <div className="stamp__row">
            <dt>Bulletin</dt>
            <dd>
              {bulletin ? `${String(bulletin.week).padStart(2, '0')} / ${bulletin.year}` : '—'}
            </dd>
          </div>
          <div className="stamp__row">
            <dt>Week of</dt>
            <dd>{formatWeek(week)}</dd>
          </div>
          <div className="stamp__row">
            <dt>Read at</dt>
            <dd>{now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} IST</dd>
          </div>
        </dl>

        <button
          type="button"
          className={`source-badge ${isSynthetic ? 'source-badge--synthetic' : 'source-badge--real'}`}
          onClick={onAbout}
        >
          <span className="source-badge__dot" aria-hidden="true" />
          {isSynthetic ? 'Simulated data' : sourceLabel}
          <span className="source-badge__more">About the data</span>
        </button>
      </div>
    </header>
  );
}
