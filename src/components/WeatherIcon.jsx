/**
 * The five weather glyphs, one per Storm Index tier.
 *
 * Drawn inline rather than pulled from an icon font so they inherit the tier
 * accent colour and stay crisp at the very different sizes they appear at:
 * 14px in the ticker, 20px in the legend, 56px in the detail panel.
 */
import React from 'react';
import { TIER_ACCENT } from '../lib/stormIndex.js';

function Sun({ cx = 12, cy = 12, r = 4.4 }) {
  const rays = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="currentColor" />
      {rays.map((deg) => (
        <line
          key={deg}
          x1={cx}
          y1={cy - r - 1.6}
          x2={cx}
          y2={cy - r - 3.4}
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          transform={`rotate(${deg} ${cx} ${cy})`}
        />
      ))}
    </g>
  );
}

function Cloud({ y = 0, scale = 1, opacity = 1 }) {
  return (
    <g transform={`translate(0 ${y}) scale(${scale})`} opacity={opacity}>
      <path
        d="M7.2 18.4h9.9a3.9 3.9 0 0 0 .5-7.77 5.6 5.6 0 0 0-10.6-1.5A3.85 3.85 0 0 0 7.2 18.4Z"
        fill="currentColor"
      />
    </g>
  );
}

function Drops({ ys = [0, 0, 0], xs = [8.5, 12, 15.5] }) {
  return (
    <g stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" opacity="0.95">
      {xs.map((x, i) => (
        <line key={x} x1={x} y1={19.6 + ys[i]} x2={x - 1.1} y2={22.4 + ys[i]} />
      ))}
    </g>
  );
}

const GLYPHS = {
  clear: () => <Sun />,
  hazy: () => (
    <g>
      <Sun cx={9} cy={9} r={3.4} />
      <Cloud />
    </g>
  ),
  overcast: () => (
    <g>
      <Cloud y={-3.6} scale={0.72} opacity={0.45} />
      <Cloud y={-0.5} />
    </g>
  ),
  storm: () => (
    <g>
      <Cloud y={-2} />
      <Drops ys={[0, 1.2, 0]} />
    </g>
  ),
  cloudburst: () => (
    <g>
      <Cloud y={-2.6} />
      <path d="M13.6 16.4 9.4 22.6h2.9l-1.2 4.4 4.5-6.5h-3l1-4.1Z" fill="currentColor" />
      <Drops xs={[7.6, 17.2]} ys={[0.4, 0]} />
    </g>
  ),
};

export default function WeatherIcon({ tier, size = 24, className = '', title }) {
  const Glyph = GLYPHS[tier] ?? GLYPHS.overcast;
  return (
    <svg
      className={`weather-icon weather-icon--${tier} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 26"
      style={{ color: TIER_ACCENT[tier] }}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <Glyph />
    </svg>
  );
}
