/**
 * The crawl along the bottom, in the register of a weather channel. Content is
 * generated from the dataset (see lib/narrative.js), so it stays true when the
 * data is swapped.
 */
import React, { useMemo } from 'react';
import WeatherIcon from './WeatherIcon.jsx';

/**
 * Weather tones use the real glyphs so the crawl matches the map; direction
 * tones use triangles. Drawn rather than typed — exotic symbol codepoints
 * (cloud-with-lightning, encircled i) tofu out on machines with thin font
 * coverage, which is exactly the machine a demo ends up running on.
 */
const TONE_TIER = {
  cloudburst: 'cloudburst',
  storm: 'storm',
  clear: 'clear',
  info: 'overcast',
};

function Mark({ tone }) {
  if (tone === 'rising') return <span className="ticker__mark">▲</span>;
  if (tone === 'easing') return <span className="ticker__mark">▼</span>;
  return <WeatherIcon tier={TONE_TIER[tone] ?? 'overcast'} size={17} className="ticker__glyph" />;
}

export default function Ticker({ items }) {
  // Duration scales with content so the speed feels constant regardless of how
  // many alerts the data produced.
  const duration = useMemo(() => Math.max(38, items.length * 6.5), [items.length]);

  const run = (ariaHidden) => (
    <div className="ticker__run" aria-hidden={ariaHidden || undefined}>
      {items.map((item) => (
        <span key={`${ariaHidden ? 'b' : 'a'}-${item.id}`} className={`ticker__item ticker__item--${item.tone}`}>
          <Mark tone={item.tone} />
          {item.text}
        </span>
      ))}
    </div>
  );

  return (
    <div className="ticker">
      <span className="ticker__badge">Warnings in force</span>
      <div className="ticker__viewport">
        <div className="ticker__track" style={{ animationDuration: `${duration}s` }}>
          {run(false)}
          {run(true)}
        </div>
      </div>
    </div>
  );
}
