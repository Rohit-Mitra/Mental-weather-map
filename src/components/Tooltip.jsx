/** Quick-glance hover readout. Follows the pointer, never covers it. */
import React from 'react';
import WeatherIcon from './WeatherIcon.jsx';
import { TIER_ACCENT, colorFor, tierFor } from '../lib/stormIndex.js';

export default function Tooltip({ hover }) {
  if (!hover) return null;
  const tier = tierFor(hover.index);

  // Flip to the other side of the cursor near the viewport edges.
  const flipX = hover.x > window.innerWidth - 230;
  const flipY = hover.y > window.innerHeight - 140;

  return (
    <div
      className="tooltip"
      style={{
        left: hover.x,
        top: hover.y,
        transform: `translate(${flipX ? 'calc(-100% - 18px)' : '18px'}, ${
          flipY ? 'calc(-100% - 18px)' : '18px'
        })`,
        '--accent': TIER_ACCENT[tier.key],
      }}
      role="status"
    >
      <div className="tooltip__head">
        <WeatherIcon tier={tier.key} size={26} />
        <div>
          <div className="tooltip__name">{hover.name}</div>
          <div className="tooltip__tier">
            {tier.level} · {tier.label}
          </div>
        </div>
      </div>
      <div className="tooltip__index">
        <span className="tooltip__number" style={{ color: colorFor(hover.index) }}>
          {hover.index}
        </span>
        <span className="tooltip__scale">/100 Storm Index</span>
      </div>
      <div className="tooltip__cta">Click for the full forecast</div>
    </div>
  );
}
