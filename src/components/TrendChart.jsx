/**
 * "Forecast history" — the Storm Index over the last 12 months, drawn like the
 * temperature strip in a weather app rather than like a business chart: soft
 * gradient under the line, tier bands behind it for context, month ticks, and a
 * scrubbable readout.
 *
 * Hand-rolled SVG rather than a chart library: ~120 lines, no dependency, and
 * total control over the aesthetic.
 */
import React, { useMemo, useState } from 'react';
import { TIERS, colorFor, formatMonth, formatWeek, tierFor } from '../lib/stormIndex.js';

const W = 340;
const H = 132;
const PAD = { top: 10, right: 8, bottom: 20, left: 26 };

export default function TrendChart({ history, markerIndex, accent }) {
  const [hoverI, setHoverI] = useState(null);

  const geometry = useMemo(() => {
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const n = history.length;
    const x = (i) => PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const y = (v) => PAD.top + innerH - (v / 100) * innerH;

    const points = history.map((h, i) => [x(i), y(h.storm_index)]);
    const line = points.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' ');
    const area = `${line} L${points[points.length - 1][0].toFixed(1)} ${(PAD.top + innerH).toFixed(1)} L${points[0][0].toFixed(1)} ${(PAD.top + innerH).toFixed(1)} Z`;

    // One tick per month change, so the axis reads Sep / Oct / Nov ...
    // A month boundary can fall a few days after the window starts, which puts
    // two labels on top of each other ("AugSep"); enforce a minimum gap and let
    // the later, fully-represented month win.
    const MIN_TICK_GAP = 24;
    const ticks = [];
    let lastMonth = null;
    history.forEach((h, i) => {
      const m = h.week.slice(0, 7);
      if (m === lastMonth) return;
      lastMonth = m;
      const px = x(i);
      const prev = ticks[ticks.length - 1];
      if (prev && px - prev.x < MIN_TICK_GAP) {
        ticks[ticks.length - 1] = { i, x: px, label: formatMonth(h.week) };
        return;
      }
      ticks.push({ i, x: px, label: formatMonth(h.week) });
    });

    return { x, y, points, line, area, ticks };
  }, [history]);

  const activeI = hoverI ?? markerIndex;
  const active = history[activeI];
  const activePoint = geometry.points[activeI];

  const handleMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const rel = ((event.clientX - rect.left) / rect.width) * W;
    const innerW = W - PAD.left - PAD.right;
    const t = (rel - PAD.left) / innerW;
    const i = Math.round(t * (history.length - 1));
    setHoverI(Math.max(0, Math.min(history.length - 1, i)));
  };

  return (
    <figure className="trend-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="trend-chart__svg"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverI(null)}
        role="img"
        aria-label={`Storm index over the last ${history.length} weeks`}
      >
        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.45" />
            <stop offset="100%" stopColor={accent} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Tier bands: the same colour language as the map, faint. */}
        {TIERS.map((tier) => {
          const yTop = geometry.y(tier.max);
          const yBottom = geometry.y(tier.min);
          return (
            <rect
              key={tier.key}
              x={PAD.left}
              y={yTop}
              width={W - PAD.left - PAD.right}
              height={Math.max(0, yBottom - yTop)}
              fill={colorFor((tier.min + tier.max) / 2)}
              opacity="0.09"
            />
          );
        })}

        {/* Storm-watch threshold. */}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={geometry.y(66)}
          y2={geometry.y(66)}
          className="trend-chart__threshold"
        />
        <text x={PAD.left + 3} y={geometry.y(66) - 3.5} className="trend-chart__threshold-label">
          storm watch
        </text>

        {[0, 50, 100].map((v) => (
          <text key={v} x={PAD.left - 6} y={geometry.y(v) + 3} className="trend-chart__ytick">
            {v}
          </text>
        ))}

        <path d={geometry.area} fill="url(#trend-fill)" />
        <path d={geometry.line} className="trend-chart__line" style={{ stroke: accent }} />

        {geometry.ticks.map((t) => (
          <text key={t.i} x={t.x} y={H - 6} className="trend-chart__xtick">
            {t.label}
          </text>
        ))}

        {activePoint && (
          <g className="trend-chart__marker">
            <line x1={activePoint[0]} x2={activePoint[0]} y1={PAD.top} y2={H - PAD.bottom} />
            <circle cx={activePoint[0]} cy={activePoint[1]} r="4.2" style={{ fill: accent }} />
            <circle cx={activePoint[0]} cy={activePoint[1]} r="8" className="trend-chart__marker-halo" style={{ fill: accent }} />
          </g>
        )}
      </svg>

      <figcaption className="trend-chart__caption">
        {active ? (
          <>
            <span className="trend-chart__caption-week">{formatWeek(active.week)}</span>
            <span className="trend-chart__caption-value" style={{ color: accent }}>
              {active.storm_index}
            </span>
            <span className="trend-chart__caption-tier">{tierFor(active.storm_index).label}</span>
          </>
        ) : (
          'Storm Index, last 12 months'
        )}
      </figcaption>
    </figure>
  );
}
