/**
 * Replay the last 12 months: drag to move the whole map through time, or press
 * play to watch systems build and cross the country.
 */
import React, { useEffect } from 'react';
import { formatWeek } from '../lib/stormIndex.js';

export default function TimeScrubber({ weeks, value, onChange, playing, onTogglePlay, disabled }) {
  const last = weeks.length - 1;

  useEffect(() => {
    if (!playing || disabled) return undefined;
    const id = setInterval(() => {
      onChange((prev) => (prev >= last ? 0 : prev + 1));
    }, 240);
    return () => clearInterval(id);
  }, [playing, disabled, last, onChange]);

  return (
    <div className={`scrubber ${disabled ? 'is-disabled' : ''}`}>
      <button
        type="button"
        className="scrubber__play"
        onClick={onTogglePlay}
        disabled={disabled}
        aria-label={playing ? 'Pause replay' : 'Play 12-month replay'}
      >
        <svg viewBox="0 0 14 14" width="12" height="12" aria-hidden="true" focusable="false">
          {playing ? (
            <>
              <rect x="2.5" y="2" width="3.2" height="10" rx="1" fill="currentColor" />
              <rect x="8.3" y="2" width="3.2" height="10" rx="1" fill="currentColor" />
            </>
          ) : (
            <path d="M3.4 2.2 12 7l-8.6 4.8Z" fill="currentColor" />
          )}
        </svg>
      </button>

      <div className="scrubber__body">
        <div className="scrubber__labels">
          <span className="scrubber__title">
            {disabled ? 'Replay — switch to current conditions' : 'Replay the last 12 months'}
          </span>
          <span className="scrubber__week">{formatWeek(weeks[value])}</span>
        </div>
        <input
          type="range"
          className="scrubber__range"
          min="0"
          max={last}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="Week of the 12-month replay"
          aria-valuetext={formatWeek(weeks[value])}
        />
        <div className="scrubber__ends">
          <span>{formatWeek(weeks[0])}</span>
          <span>{formatWeek(weeks[last])}</span>
        </div>
      </div>

      {value !== last && !disabled && (
        <button type="button" className="scrubber__now" onClick={() => onChange(last)}>
          Back to now
        </button>
      )}
    </div>
  );
}
