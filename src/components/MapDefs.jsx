/**
 * Every reusable paint the map needs: cloud patterns, rain patterns, glows.
 *
 * The performance trick that makes 51 animated states cheap: weather is painted
 * with a handful of shared SVG <pattern>s rather than per-state particles. A
 * state's cloud cover and rain are just `fill="url(#rain-storm)"` on a copy of
 * its own path, which means the effect is clipped to the state's borders for
 * free, and all 51 states animate off the same few keyframe timelines.
 *
 * Patterns are animated by translating a <g> *inside* the tile. Content is laid
 * out in three copies offset by exactly one tile, and the animation travels
 * exactly one tile, so the loop is seamless with no visible seam or reset.
 */
import React from 'react';

/**
 * One cloud bank. The puffs are filled with a radial gradient rather than a
 * flat colour: flat ellipses read as polka dots at map scale, soft-edged ones
 * blend into continuous cover. Sizes and overlaps are deliberately irregular so
 * the tile does not announce itself.
 */
function CloudBank({ fill }) {
  const puffs = [
    [12, 18, 25, 15],
    [33, 10, 20, 12],
    [30, 26, 23, 13],
    [55, 21, 24, 14],
    [74, 12, 19, 11],
    [83, 28, 21, 12],
    [18, 45, 22, 13],
    [42, 52, 25, 15],
    [64, 46, 20, 12],
    [80, 58, 18, 10],
    [3, 61, 19, 11],
    [52, 34, 16, 10],
  ];
  return (
    <g>
      {puffs.map(([cx, cy, rx, ry]) => (
        <ellipse key={`${cx}-${cy}`} cx={cx} cy={cy} rx={rx} ry={ry} fill={fill} />
      ))}
    </g>
  );
}

/** Three tile-offset copies so a one-tile translation loops seamlessly. */
function Tiled({ width, children }) {
  return (
    <>
      <g transform={`translate(${-width} 0)`}>{children}</g>
      {children}
      <g transform={`translate(${width} 0)`}>{children}</g>
    </>
  );
}

function CloudPattern({ id, fill, className, width = 92, height = 68 }) {
  return (
    <pattern id={id} patternUnits="userSpaceOnUse" width={width} height={height}>
      <g className={className}>
        <Tiled width={width}>
          <CloudBank fill={fill} />
        </Tiled>
      </g>
    </pattern>
  );
}

function RainDrops({ opacity }) {
  // Varied lengths and offsets: uniform drops at uniform spacing read as
  // diagonal hatching rather than as falling rain.
  const drops = [
    [1.6, 0.8, 3.4],
    [5.6, 4.2, 2.5],
    [8.8, 1.9, 3.8],
    [3.7, 8.4, 2.8],
    [10.5, 7.0, 3.2],
  ];
  return (
    <g stroke="#dbebff" strokeWidth="0.7" strokeLinecap="round" opacity={opacity}>
      {drops.map(([x, y, len]) => (
        <line key={`${x}-${y}`} x1={x} y1={y} x2={x - 0.5} y2={y + len} />
      ))}
    </g>
  );
}

function RainPattern({ id, className, opacity, tilt }) {
  const width = 12.5;
  const height = 13;
  return (
    <pattern
      id={id}
      patternUnits="userSpaceOnUse"
      width={width}
      height={height}
      patternTransform={`rotate(${tilt})`}
    >
      <g className={className}>
        <g transform={`translate(0 ${-height})`}>
          <RainDrops opacity={opacity} />
        </g>
        <RainDrops opacity={opacity} />
        <g transform={`translate(0 ${height})`}>
          <RainDrops opacity={opacity} />
        </g>
      </g>
    </pattern>
  );
}

export default function MapDefs() {
  return (
    <defs>
      {/* ---- cloud cover, one per density tier ------------------------- */}
      <radialGradient id="puff-light">
        <stop offset="0%" stopColor="#e3efff" stopOpacity="0.30" />
        <stop offset="55%" stopColor="#d5e6ff" stopOpacity="0.15" />
        <stop offset="100%" stopColor="#d5e6ff" stopOpacity="0" />
      </radialGradient>
      {/* Cloudy must MUTE the state, not brighten it: a desaturated grey at
          moderate opacity greys the fill down the way overcast does. */}
      <radialGradient id="puff-mid">
        <stop offset="0%" stopColor="#9fb0cb" stopOpacity="0.44" />
        <stop offset="55%" stopColor="#8b9cb8" stopOpacity="0.24" />
        <stop offset="100%" stopColor="#8b9cb8" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="puff-dark">
        <stop offset="0%" stopColor="#0d0b13" stopOpacity="0.6" />
        <stop offset="55%" stopColor="#12101a" stopOpacity="0.33" />
        <stop offset="100%" stopColor="#12101a" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="puff-ambient">
        <stop offset="0%" stopColor="#cfd8ea" stopOpacity="0.075" />
        <stop offset="60%" stopColor="#cfd8ea" stopOpacity="0.032" />
        <stop offset="100%" stopColor="#cfd8ea" stopOpacity="0" />
      </radialGradient>

      <CloudPattern id="cloud-light" fill="url(#puff-light)" className="drift drift-slow" />
      <CloudPattern id="cloud-mid" fill="url(#puff-mid)" className="drift drift-mid" />
      <CloudPattern id="cloud-dark" fill="url(#puff-dark)" className="drift drift-fast" />

      {/* Ambient layer over the whole map: bigger, fainter, slower. */}
      <CloudPattern
        id="cloud-ambient"
        fill="url(#puff-ambient)"
        className="drift drift-ambient"
        width={260}
        height={190}
      />

      {/* ---- rain ------------------------------------------------------ */}
      <RainPattern id="rain-storm" className="rain rain-storm" opacity={0.27} tilt={13} />
      <RainPattern id="rain-severe" className="rain rain-severe" opacity={0.42} tilt={18} />

      {/* ---- light ----------------------------------------------------- */}
      <radialGradient id="sun-glow">
        <stop offset="0%" stopColor="#fff3d2" stopOpacity="0.42" />
        <stop offset="40%" stopColor="#ffd98a" stopOpacity="0.16" />
        <stop offset="100%" stopColor="#ffd07a" stopOpacity="0" />
      </radialGradient>

      {/* Top-down sheen: cheap depth so states read as lit from above. */}
      <linearGradient id="state-sheen" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#fff6e8" stopOpacity="0.07" />
        <stop offset="55%" stopColor="#fff6e8" stopOpacity="0.01" />
        <stop offset="100%" stopColor="#0a0810" stopOpacity="0.2" />
      </linearGradient>

      <filter id="soft-glow" x="-12%" y="-12%" width="124%" height="124%">
        <feGaussianBlur stdDeviation="5" />
      </filter>

      <filter id="alert-glow" x="-25%" y="-25%" width="150%" height="150%">
        <feGaussianBlur stdDeviation="3.5" />
      </filter>
    </defs>
  );
}
