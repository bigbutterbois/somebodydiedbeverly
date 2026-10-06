// Lays out the 435 House districts as a hex tile map: one equal-size hex per
// district, each state a compact blob near where the state really is.
//
//   node scripts/district-tiles.mjs house-latest.json > src/app/admin/forecast/house/districtTiles.json
//
// The input is the forecast's house/latest.json (or districts.json); only the
// district ids are read. Re-run it if a state's seat count changes (after the
// 2030 census). Tiles are not district shapes: within a state, districts are
// numbered in reading order, and redrawn states keep their tiles.
//
// How: each state starts as a circle sized by its seats at its real centroid
// (Albers USA, from us-atlas); the circles are pushed apart until none overlap
// (a Dorling cartogram), then each state fills hexes outward from its circle's
// center, biggest states first.
import { readFileSync } from "node:fs";
import { geoPath } from "d3-geo";
import { feature } from "topojson-client";

const input = JSON.parse(readFileSync(process.argv[2], "utf8"));
const ids = (input.races ?? input).map((r) => r.state ?? r.id);

const us = JSON.parse(readFileSync(new URL("../node_modules/us-atlas/states-albers-10m.json", import.meta.url)));
const path = geoPath();
const POSTAL = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA", Colorado: "CO", Connecticut: "CT",
  Delaware: "DE", Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA",
  Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD", Massachusetts: "MA", Michigan: "MI",
  Minnesota: "MN", Mississippi: "MS", Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH",
  "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH",
  Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD",
  Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT", Virginia: "VA", Washington: "WA", "West Virginia": "WV",
  Wisconsin: "WI", Wyoming: "WY",
};
const centroid = {};
for (const f of feature(us, us.objects.states).features) {
  const code = POSTAL[f.properties.name];
  if (code) centroid[code] = path.centroid(f);
}

// Districts per state, in number order ("AK-AL" is the at-large seat).
const byState = {};
for (const id of ids) (byState[id.slice(0, 2)] ??= []).push(id);
for (const list of Object.values(byState)) list.sort((a, b) => (parseInt(a.slice(3)) || 0) - (parseInt(b.slice(3)) || 0));

const S = 10; // hex radius, px
const HEX_AREA = (3 * Math.sqrt(3) * S * S) / 2;
// Squeeze the real geography so the tiles fill it about as densely as a tile map should.
const SQUEEZE = 0.62;
const states = Object.entries(byState).map(([code, list]) => {
  const [x, y] = centroid[code];
  return { code, list, home: [x * SQUEEZE, y * SQUEEZE], p: [x * SQUEEZE, y * SQUEEZE], r: Math.sqrt((list.length * HEX_AREA) / Math.PI) + S * 0.9 };
});

// Dorling: push overlapping circles apart, with a weak pull back home.
for (let iter = 0; iter < 2000; iter++) {
  for (let i = 0; i < states.length; i++) {
    for (let j = i + 1; j < states.length; j++) {
      const a = states[i], b = states[j];
      const dx = b.p[0] - a.p[0], dy = b.p[1] - a.p[1];
      const d = Math.hypot(dx, dy) || 0.01;
      const overlap = a.r + b.r - d;
      if (overlap > 0) {
        const wa = b.r / (a.r + b.r), wb = a.r / (a.r + b.r);
        a.p[0] -= (dx / d) * overlap * wa * 0.5; a.p[1] -= (dy / d) * overlap * wa * 0.5;
        b.p[0] += (dx / d) * overlap * wb * 0.5; b.p[1] += (dy / d) * overlap * wb * 0.5;
      }
    }
  }
  for (const s of states) {
    s.p[0] += (s.home[0] - s.p[0]) * 0.01;
    s.p[1] += (s.home[1] - s.p[1]) * 0.01;
  }
}

// Pointy-top hexes in axial coordinates.
const center = (q, r) => [S * Math.sqrt(3) * (q + r / 2), S * 1.5 * r];
const toHex = ([x, y]) => {
  const r = Math.round(y / (S * 1.5));
  return [Math.round(x / (S * Math.sqrt(3)) - r / 2), r];
};
const NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];
const taken = new Map();
const key = (q, r) => `${q},${r}`;
const dist = (q, r, p) => Math.hypot(center(q, r)[0] - p[0], center(q, r)[1] - p[1]);

function nearestFree(p) {
  const [q0, r0] = toHex(p);
  let best = null;
  for (let rad = 0; !best; rad++) {
    for (let dq = -rad; dq <= rad; dq++) {
      for (let dr = -rad; dr <= rad; dr++) {
        const q = q0 + dq, r = r0 + dr;
        if (taken.has(key(q, r))) continue;
        if (!best || dist(q, r, p) < dist(best[0], best[1], p)) best = [q, r];
      }
    }
  }
  return best;
}

const cells = {};
for (const s of [...states].sort((a, b) => b.list.length - a.list.length)) {
  const blob = [nearestFree(s.p)];
  taken.set(key(...blob[0]), s.code);
  while (blob.length < s.list.length) {
    let best = null;
    for (const [q, r] of blob) {
      for (const [dq, dr] of NEIGHBORS) {
        const c = [q + dq, r + dr];
        if (taken.has(key(...c))) continue;
        if (!best || dist(...c, s.p) < dist(...best, s.p)) best = c;
      }
    }
    best ??= nearestFree(s.p); // boxed in: start a second piece
    taken.set(key(...best), s.code);
    blob.push(best);
  }
  // Number districts in reading order: top row first, left to right.
  blob.sort((a, b) => a[1] - b[1] || center(...a)[0] - center(...b)[0]);
  s.list.forEach((id, i) => (cells[id] = blob[i]));
}

process.stdout.write(JSON.stringify({ size: S, cells }) + "\n");
