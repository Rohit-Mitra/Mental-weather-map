/**
 * build_geo.mjs — one-time geometry precompute (build tooling, not runtime).
 *
 * Reads the vendored India TopoJSON (scripts/india-states.topo.json, produced by
 * prepare_source_geo.mjs) and emits flat, committed SVG path strings:
 *
 *   src/data/india-states-paths.json
 *   { viewBox, width, height, mapWidth, nation, borders,
 *     states: [{ code, name, d, centroid:[x,y], bounds:[[x0,y0],[x1,y1]], area }] }
 *
 * Doing this at build time means the browser bundle ships ZERO geo libraries
 * (no d3-geo, no topojson-client) and the map renders instantly and offline.
 * Re-run with:  npm run build:geo
 *
 * `borders` is the interior border mesh, drawn once so shared boundaries are not
 * stroked twice; `nation` is the coastline/frontier, drawn as the outer edge.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { geoMercator, geoPath } from 'd3-geo';
import { feature, mesh } from 'topojson-client';

// Common Indian state/UT abbreviations — the ones people actually recognise
// (CG, OD, UK, TG rather than the stricter ISO CT/OD/UT/TS).
const CODES = {
  'Andaman and Nicobar Islands': 'AN', 'Andhra Pradesh': 'AP', 'Arunachal Pradesh': 'AR',
  Assam: 'AS', Bihar: 'BR', Chandigarh: 'CH', Chhattisgarh: 'CG',
  'Dadra and Nagar Haveli and Daman and Diu': 'DD', Delhi: 'DL', Goa: 'GA',
  Gujarat: 'GJ', Haryana: 'HR', 'Himachal Pradesh': 'HP', 'Jammu and Kashmir': 'JK',
  Jharkhand: 'JH', Karnataka: 'KA', Kerala: 'KL', Ladakh: 'LA', Lakshadweep: 'LD',
  'Madhya Pradesh': 'MP', Maharashtra: 'MH', Manipur: 'MN', Meghalaya: 'ML',
  Mizoram: 'MZ', Nagaland: 'NL', Odisha: 'OD', Puducherry: 'PY', Punjab: 'PB',
  Rajasthan: 'RJ', Sikkim: 'SK', 'Tamil Nadu': 'TN', Telangana: 'TG', Tripura: 'TR',
  'Uttar Pradesh': 'UP', Uttarakhand: 'UK', 'West Bengal': 'WB',
};

// Short display names for the few that are unwieldy on screen.
const SHORT_NAMES = {
  'Dadra and Nagar Haveli and Daman and Diu': 'Dadra & Nagar Haveli and Daman & Diu',
  'Andaman and Nicobar Islands': 'Andaman & Nicobar Islands',
  'Jammu and Kashmir': 'Jammu & Kashmir',
};

const MAP_W = 560;   // width the landmass is fitted into
const PAD = 10;      // breathing room around the landmass
const GUTTER = 104;  // right-hand column for the north-east label stack

const topo = JSON.parse(readFileSync('scripts/india-states.topo.json', 'utf8'));
const fc = feature(topo, topo.objects.states);

const projection = geoMercator().fitWidth(MAP_W - PAD * 2, fc);
const path = geoPath(projection);

// Re-seat the landmass at [PAD, PAD] and derive the viewBox from its real extent.
const [[bx0, by0], [bx1, by1]] = path.bounds(fc);
const [tx, ty] = projection.translate();
projection.translate([tx - bx0 + PAD, ty - by0 + PAD]);

const mapHeight = Math.ceil(by1 - by0 + PAD * 2);
const width = MAP_W + GUTTER;
const height = mapHeight;

const round = (n) => +n.toFixed(1);

const states = fc.features
  .map((f) => {
    const name = f.properties.name;
    const code = CODES[name];
    if (!code) throw new Error(`no code mapped for "${name}"`);
    return {
      code,
      name: SHORT_NAMES[name] ?? name,
      d: path(f),
      centroid: path.centroid(f).map(round),
      bounds: path.bounds(f).map((p) => p.map(round)),
      area: Math.round(path.area(f)),
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const out = {
  viewBox: `0 0 ${width} ${height}`,
  width,
  height,
  mapWidth: MAP_W,
  nation: mesh(topo, topo.objects.states, (a, b) => a === b),
  borders: mesh(topo, topo.objects.states, (a, b) => a !== b),
  states,
};
out.nation = path(out.nation);
out.borders = path(out.borders);

writeFileSync('src/data/india-states-paths.json', JSON.stringify(out));

console.log(`wrote src/data/india-states-paths.json — ${states.length} states/UTs`);
console.log(`viewBox ${out.viewBox} (map ${MAP_W} + ${GUTTER} label gutter)`);
console.log('smallest by area:', states.slice().sort((a, b) => a.area - b.area).slice(0, 10)
  .map((s) => `${s.code}:${s.area}`).join(' '));
console.log('largest by area:', states.slice().sort((a, b) => b.area - a.area).slice(0, 4)
  .map((s) => `${s.code}:${s.area}`).join(' '));
