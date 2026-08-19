/**
 * The map. A choropleth of India's 28 states and 8 union territories where the
 * "colour scale" is weather: fill follows the IMD warning ladder, and each band
 * layers on the animation that makes the metaphor legible without reading the
 * ladder — drifting haze, cloud, falling rain, lightning flicker, and a pulsing
 * red ring on the states under warning.
 *
 * Geometry is precomputed by scripts/build_geo.mjs into flat SVG path strings
 * (Mercator, 664x634 including a right-hand label gutter), so no projection
 * maths happens in the browser.
 */
import React, { useMemo } from 'react';
import MapDefs from './MapDefs.jsx';
import { TIER_ACCENT, colorFor } from '../lib/stormIndex.js';

/** Which animated layers each band switches on. */
const TIER_LAYERS = {
  clear: { cloud: null, rain: null, lightning: null, sun: true },
  hazy: { cloud: 'cloud-light', rain: null, lightning: null, sun: false },
  overcast: { cloud: 'cloud-mid', rain: null, lightning: null, sun: false },
  storm: { cloud: 'cloud-dark', rain: 'rain-storm', lightning: 'storm', sun: false },
  cloudburst: { cloud: 'cloud-dark', rain: 'rain-severe', lightning: 'severe', sun: false },
};

/**
 * Union territories too small to see at this scale. They are drawn as a weather
 * station disc as well as their true outline, so every unit in the dataset is
 * visible and clickable rather than silently absent.
 */
const MARKER_UNITS = new Set(['CH', 'LD', 'PY', 'DD', 'DL', 'GA']);

/**
 * Labels placed outside their unit with a leader line. Used only where the
 * leader runs over empty ground — sea, or beyond the frontier — so no leader
 * ever cuts across another state.
 */
const LEADER_LABELS = {
  NL: { x: 588, y: 232, anchor: 'start', from: [510, 249] },
  MN: { x: 588, y: 258, anchor: 'start', from: [501, 277] },
  MZ: { x: 588, y: 286, anchor: 'start', from: [477, 307] },
  TR: { x: 424, y: 320, anchor: 'end', from: [438, 307] },
  AN: { x: 497, y: 506, anchor: 'start', from: [483, 512] },
  PY: { x: 286, y: 546, anchor: 'start', from: [232, 541] },
  GA: { x: 72, y: 466, anchor: 'end', from: [112, 461] },
  DD: { x: 50, y: 358, anchor: 'end', from: [61, 361] },
  LD: { x: 114, y: 599, anchor: 'start', from: [103, 596] },
};

/** Micro-units with no room for a leader: the label sits beside the marker. */
const ADJACENT_LABELS = { DL: [10, 4], CH: [9, -5] };

/** Nudges where a centroid lands badly for a label. */
const LABEL_NUDGE = {
  SK: [0, -13], ML: [0, 3], AS: [-4, -4], AR: [6, 0], WB: [-3, 16],
  KL: [-3, 0], HP: [4, -4], UK: [4, 2], JK: [-4, 4],
};

const INLINE_MIN_AREA = 220;

/** Stable pseudo-random in [0,1) from a state code, for desyncing animations. */
function hash01(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

function sunRadius(area) {
  // Deliberately small: a subtle glow, not a wash that hides the state's colour.
  return Math.max(6, Math.min(20, Math.sqrt(area) / 3.4));
}

function StateCell({ row }) {
  const { d, code, tier, index } = row;
  const layers = TIER_LAYERS[tier] ?? TIER_LAYERS.overcast;
  const jitter = hash01(code);

  return (
    <g className={`state state--${tier}`} data-code={code}>
      <path d={d} fill={colorFor(index)} className="state-fill" />
      <path d={d} fill="url(#state-sheen)" className="state-sheen" />
      {layers.cloud && <path d={d} fill={`url(#${layers.cloud})`} className="state-cloud" />}
      {layers.rain && <path d={d} fill={`url(#${layers.rain})`} className="state-rain" />}
      {layers.lightning && (
        <path
          d={d}
          className={`state-lightning state-lightning--${layers.lightning}`}
          style={{ animationDelay: `-${(jitter * 9).toFixed(2)}s` }}
        />
      )}
    </g>
  );
}

export default function WeatherMap({
  geo,
  rows,
  selectedCode,
  hoveredCode,
  onSelect,
  onHover,
  viewLabel,
}) {
  const byCode = useMemo(() => Object.fromEntries(rows.map((r) => [r.code, r])), [rows]);
  const selectedRow = selectedCode ? byCode[selectedCode] : null;
  const hoveredRow = hoveredCode ? byCode[hoveredCode] : null;
  const warningRows = rows.filter((r) => r.tier === 'cloudburst');
  const sunRows = rows.filter((r) => r.tier === 'clear' && r.area > 400);
  const markerRows = rows.filter((r) => MARKER_UNITS.has(r.code));

  const handleKey = (event, code) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(code);
    }
  };

  const isActive = (code) => code === hoveredCode || code === selectedCode;

  return (
    <svg
      className="weather-map"
      viewBox={geo.viewBox}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Map of India showing the storm index by state, ${viewLabel}`}
    >
      <MapDefs />

      <g className="map-halo" aria-hidden="true">
        <path d={geo.nation} className="nation-glow" filter="url(#soft-glow)" />
      </g>

      {/* Weather per state. */}
      <g className="states-layer" aria-hidden="true">
        {rows.map((row) => (
          <StateCell key={row.code} row={row} />
        ))}
      </g>

      {/* Borders come from a shared mesh, so every boundary is stroked exactly
          once and no state's cloud cover swallows its neighbour's outline. */}
      <g className="borders-layer" aria-hidden="true">
        <path d={geo.borders} className="state-border" />
        <path d={geo.nation} className="nation-outline" />
      </g>

      <g className="sun-layer" aria-hidden="true">
        {sunRows.map((row) => (
          <circle
            key={row.code}
            cx={row.centroid[0]}
            cy={row.centroid[1]}
            r={sunRadius(row.area)}
            fill="url(#sun-glow)"
            className="sun-glow"
            style={{ animationDelay: `-${(hash01(row.code) * 6).toFixed(2)}s` }}
          />
        ))}
      </g>

      {/* Station discs for the union territories too small to see. */}
      <g className="markers-layer" aria-hidden="true">
        {markerRows.map((row) => (
          <g key={row.code} className={`marker ${isActive(row.code) ? 'is-active' : ''}`}>
            <circle cx={row.centroid[0]} cy={row.centroid[1]} r="5.4" className="marker__halo" />
            <circle
              cx={row.centroid[0]}
              cy={row.centroid[1]}
              r="3.6"
              className="marker__dot"
              style={{ fill: colorFor(row.index) }}
            />
          </g>
        ))}
      </g>

      {/* Red-warning rings. */}
      <g className="alerts-layer" aria-hidden="true">
        {warningRows.map((row) => (
          <g key={row.code} className="alert">
            <path d={row.d} className="alert-halo" filter="url(#alert-glow)" />
            <path d={row.d} className="alert-ring" />
          </g>
        ))}
      </g>

      {/* Selection and hover rings. */}
      <g
        className="rings-layer"
        aria-hidden="true"
        style={selectedRow ? { '--accent': TIER_ACCENT[selectedRow.tier] } : undefined}
      >
        {hoveredRow && hoveredRow.code !== selectedCode && (
          <path d={hoveredRow.d} className="hover-ring" />
        )}
        {selectedRow && (
          <>
            <path d={selectedRow.d} className="selected-ring-glow" filter="url(#alert-glow)" />
            <path d={selectedRow.d} className="selected-ring" />
            {MARKER_UNITS.has(selectedRow.code) && (
              <circle
                cx={selectedRow.centroid[0]}
                cy={selectedRow.centroid[1]}
                r="8"
                className="selected-ring"
                fill="none"
              />
            )}
          </>
        )}
      </g>

      <rect
        className="ambient-clouds"
        x="0"
        y="0"
        width={geo.width}
        height={geo.height}
        fill="url(#cloud-ambient)"
        aria-hidden="true"
      />

      {/* Labels. */}
      <g className="labels-layer" aria-hidden="true">
        {rows.map((row) => {
          const leader = LEADER_LABELS[row.code];
          if (leader) {
            return (
              <g key={row.code} className={`label label--leader ${isActive(row.code) ? 'is-active' : ''}`}>
                <path
                  d={`M${leader.from[0]} ${leader.from[1]} L${leader.x + (leader.anchor === 'end' ? 4 : -4)} ${leader.y - 3}`}
                  className="label-leader"
                />
                <text
                  x={leader.x}
                  y={leader.y}
                  className="label-text label-text--leader"
                  style={{ textAnchor: leader.anchor }}
                >
                  {row.code}
                </text>
              </g>
            );
          }

          const adjacent = ADJACENT_LABELS[row.code];
          if (adjacent) {
            return (
              <text
                key={row.code}
                x={row.centroid[0] + adjacent[0]}
                y={row.centroid[1] + adjacent[1]}
                className={`label-text label-text--small ${isActive(row.code) ? 'is-active' : ''}`}
                style={{ textAnchor: 'start' }}
              >
                {row.code}
              </text>
            );
          }

          if (row.area < INLINE_MIN_AREA) return null;
          const [dx, dy] = LABEL_NUDGE[row.code] ?? [0, 0];
          return (
            <text
              key={row.code}
              x={row.centroid[0] + dx}
              y={row.centroid[1] + dy}
              className={`label-text ${row.area < 1500 ? 'label-text--small' : ''} ${
                isActive(row.code) ? 'is-active' : ''
              }`}
            >
              {row.code}
            </text>
          );
        })}
      </g>

      {/* Transparent hit targets on top, so pointer and keyboard interaction is
          never intercepted by a cloud or a rain layer. */}
      <g className="hit-layer">
        {rows.map((row) => (
          <g key={row.code}>
            <path
              d={row.d}
              className="state-hit"
              tabIndex={0}
              role="button"
              aria-label={`${row.name}. Storm index ${row.index}, ${row.tierLabel}, ${row.tierLevel}.`}
              aria-pressed={row.code === selectedCode}
              onMouseEnter={(e) => onHover(row.code, e)}
              onMouseMove={(e) => onHover(row.code, e)}
              onMouseLeave={() => onHover(null)}
              onFocus={(e) => onHover(row.code, e)}
              onBlur={() => onHover(null)}
              onClick={() => onSelect(row.code)}
              onKeyDown={(e) => handleKey(e, row.code)}
            />
            {MARKER_UNITS.has(row.code) && (
              // A 3px sliver is not a tap target; the disc is.
              <circle
                cx={row.centroid[0]}
                cy={row.centroid[1]}
                r="8"
                className="state-hit"
                onMouseEnter={(e) => onHover(row.code, e)}
                onMouseMove={(e) => onHover(row.code, e)}
                onMouseLeave={() => onHover(null)}
                onClick={() => onSelect(row.code)}
              />
            )}
          </g>
        ))}
      </g>
    </svg>
  );
}
