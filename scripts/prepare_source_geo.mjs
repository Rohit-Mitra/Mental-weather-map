/**
 * prepare_source_geo.mjs — regenerates the vendored India state boundaries.
 *
 * This is the ONLY step that needs the network, and it is not part of the normal
 * build: its output (scripts/india-states.topo.json) is committed, so
 * `npm install && npm run dev` never touches the internet.
 *
 *   node scripts/prepare_source_geo.mjs [path-to-district-geojson]
 *
 * About the source
 * ----------------
 * Upstream is a district-level GeoJSON of India that also carries one
 * state-level "blanket" polygon per state, distinguishable by a blank `district`
 * property. Those blankets are exactly what we want, so no dissolve is needed —
 * and dissolving would not have worked anyway: because every district border is
 * also traced by its state's blanket, every arc in the topology is used exactly
 * twice, so topojson's merge() cancels all of them and returns nothing.
 *
 * Two union territories (Lakshadweep, Chandigarh) have no blanket and instead
 * appear as a duplicated single district; for those we take one copy.
 *
 * The boundaries in this source are the ones conventionally depicted within
 * India — Jammu & Kashmir, Ladakh and Arunachal Pradesh are shown in full.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { topology } from 'topojson-server';
import { presimplify, simplify, quantile } from 'topojson-simplify';

const SOURCE_URL =
  'https://raw.githubusercontent.com/udit-001/india-maps-data/main/geojson/india.geojson';
const OUT = 'scripts/india-states.topo.json';
const RETAIN = 0.55; // fraction of points kept; state outlines are already coarse

const localPath = process.argv[2];
let districts;
if (localPath && existsSync(localPath)) {
  districts = JSON.parse(readFileSync(localPath, 'utf8'));
  console.log(`read ${districts.features.length} features from ${localPath}`);
} else {
  console.log(`downloading ${SOURCE_URL}`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  districts = await res.json();
  console.log(`downloaded ${districts.features.length} features`);
}

const isBlanket = (f) => !String(f.properties.district || '').trim();
const stateName = (f) => f.properties.st_nm;

const chosen = new Map();
for (const f of districts.features) {
  if (isBlanket(f)) chosen.set(stateName(f), f);
}
// Fall back to a single district copy for states that ship no blanket.
for (const f of districts.features) {
  if (!chosen.has(stateName(f))) chosen.set(stateName(f), f);
}

// Sanity check: a blanket must cover its districts, not be a stray fragment.
function bboxOf(geom, box = [Infinity, Infinity, -Infinity, -Infinity]) {
  const walk = (c) => {
    if (typeof c[0] === 'number') {
      box[0] = Math.min(box[0], c[0]); box[1] = Math.min(box[1], c[1]);
      box[2] = Math.max(box[2], c[0]); box[3] = Math.max(box[3], c[1]);
    } else c.forEach(walk);
  };
  walk(geom.coordinates);
  return box;
}

let suspect = 0;
for (const [name, blanket] of chosen) {
  const districtBox = districts.features
    .filter((f) => stateName(f) === name && !isBlanket(f))
    .reduce((box, f) => bboxOf(f.geometry, box), [Infinity, Infinity, -Infinity, -Infinity]);
  if (!Number.isFinite(districtBox[0])) continue;
  const b = bboxOf(blanket.geometry);
  const pad = 0.25; // degrees of tolerance
  if (b[0] > districtBox[0] + pad || b[1] > districtBox[1] + pad ||
      b[2] < districtBox[2] - pad || b[3] < districtBox[3] - pad) {
    console.warn(`  ! ${name}: state outline does not cover its districts`);
    suspect += 1;
  }
}
console.log(`bbox check: ${chosen.size} states, ${suspect} suspect`);

const features = [...chosen.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, f]) => ({ type: 'Feature', properties: { name }, geometry: f.geometry }));

// presimplify() annotates arc points with weights in place, so it must be called
// exactly once — quantile()'s threshold is only meaningful against that pass.
const topo = topology({ states: { type: 'FeatureCollection', features } });
const pre = presimplify(topo);
const before = pre.arcs.reduce((n, a) => n + a.length, 0);
const simplified = simplify(pre, quantile(pre, RETAIN));
const after = simplified.arcs.reduce((n, a) => n + a.length, 0);

writeFileSync(OUT, JSON.stringify(simplified));
console.log(`simplify: ${before} -> ${after} points (${((after / before) * 100).toFixed(0)}% kept)`);
console.log(`wrote ${OUT} — ${features.length} states/UTs, ${(readFileSync(OUT).length / 1024).toFixed(0)} KB`);
