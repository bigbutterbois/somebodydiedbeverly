// Builds the to-scale House map: every district's boundary, projected to Albers
// USA (Alaska and Hawaii inset), simplified, as TopoJSON with a "districts" and a
// "states" layer. Writes public/house-districts.json, which the admin House page
// loads. Runs in GitHub Actions (.github/workflows/district-shapes.yml), since it
// downloads from the Census Bureau and state GIS sites:
//
//   node scripts/district-shapes.mjs
//
// Sources are in scripts/district-sources.json. Each district gets an id like the
// forecast's ("TX-28", "WY-AL"); the script checks every forecast district has a
// shape and says when a state's "new" map looks the same as its 2024 lines.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = "public/house-districts.json";
const TMP = "tmp-district-shapes";
const FORECAST = "https://raw.githubusercontent.com/bigbutterbois/somebodydiedbeverly/forecast-data/house/latest.json";
const FIPS = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE", "12": "FL",
  "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA",
  "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE",
  "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH", "40": "OK",
  "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT", "50": "VT",
  "51": "VA", "53": "WA", "54": "WV", "55": "WI", "56": "WY",
};

const sources = JSON.parse(readFileSync("scripts/district-sources.json", "utf8"));
mkdirSync(TMP, { recursive: true });
const mapshaper = (...args) => execFileSync("npx", ["--yes", "mapshaper@0.6", ...args], { stdio: ["ignore", "inherit", "inherit"] });

async function download(url, file) {
  const res = await fetch(url, { headers: { "User-Agent": "somebodydiedbeverly district map builder" } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

/** Any source as WGS84 GeoJSON features. */
async function load(name, url) {
  if (/\/(FeatureServer|MapServer)(\/\d+)?\/?$/i.test(url)) {
    let layer = url.replace(/\/$/, "");
    if (!/\/\d+$/.test(layer)) {
      const info = await (await fetch(`${layer}?f=json`)).json();
      const poly = (info.layers ?? []).find((l) => !l.geometryType || /Polygon/i.test(l.geometryType)) ?? info.layers?.[0];
      if (!poly) throw new Error(`${url}: no layers (${JSON.stringify(info).slice(0, 200)})`);
      layer = `${layer}/${poly.id}`;
    }
    const q = `${layer}/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326`;
    const geojson = await fetch(`${q}&f=geojson`).then((r) => r.json()).catch(() => null);
    if (geojson?.features) return geojson.features;
    // Some servers only speak Esri JSON: convert its rings (outer rings clockwise, holes not).
    const json = await (await fetch(`${q}&f=json`)).json();
    if (!json.features) throw new Error(`${q}: ${JSON.stringify(json).slice(0, 300)}`);
    return json.features.map((f) => {
      const polys = [];
      for (const ring of f.geometry?.rings ?? []) {
        if (ringArea(ring) < 0 || !polys.length) polys.push([ring]);
        else polys[polys.length - 1].push(ring);
      }
      return { type: "Feature", properties: f.attributes, geometry: polys.length ? { type: "MultiPolygon", coordinates: polys } : null };
    });
  }
  const zip = `${TMP}/${name}.zip`;
  await download(url, zip);
  const out = `${TMP}/${name}.geojson`;
  mapshaper("-i", zip, "combine-files", "-merge-layers", "force", "-proj", "wgs84", "-o", out, "format=geojson");
  return JSON.parse(readFileSync(out, "utf8")).features;
}

/** The property that numbers the districts 1..n, preferring one named like a district. */
function districtNumbers(features, n) {
  const keys = Object.keys(features[0]?.properties ?? {});
  const named = (k) => /dist|^cd|^cong/i.test(k);
  const ids = (k) => /^(o?fid|objectid|id)$/i.test(k);
  for (const key of [...keys.filter(named), ...keys.filter((k) => !named(k) && !ids(k))]) {
    const nums = features.map((f) => parseInt(String(f.properties[key] ?? "").replace(/^\D+/, ""), 10));
    if (nums.some(Number.isNaN)) continue;
    const set = new Set(nums);
    if (set.size === n && [...set].every((v) => v >= 1 && v <= n)) return { key, nums };
  }
  return null;
}

const ringArea = (ring) => ring.reduce((s, [x, y], i) => { const [x2, y2] = ring[(i + 1) % ring.length]; return s + x * y2 - x2 * y; }, 0) / 2;
const area = (g) => (g.type === "Polygon" ? [g.coordinates] : g.coordinates).reduce((s, poly) => s + Math.abs(ringArea(poly[0])) - poly.slice(1).reduce((h, r) => h + Math.abs(ringArea(r)), 0), 0);
const centroid = (g) => {
  const pts = (g.type === "Polygon" ? [g.coordinates] : g.coordinates).flatMap((p) => p[0]);
  return pts.reduce(([a, b], [x, y]) => [a + x / pts.length, b + y / pts.length], [0, 0]);
};

const forecast = await (await fetch(FORECAST)).json();
const expected = new Map();
for (const r of forecast.races) (expected.get(r.state.slice(0, 2)) ?? expected.set(r.state.slice(0, 2), []).get(r.state.slice(0, 2))).push(r.state);
const idFor = (st, n) => (expected.get(st).length === 1 ? `${st}-AL` : `${st}-${String(n).padStart(2, "0")}`);

// Base: the Census 119th Congress districts (2024 lines).
console.log(`Base: ${sources.base}`);
const base = new Map();
for (const f of await load("base", sources.base)) {
  const st = FIPS[f.properties.STATEFP];
  if (!st || !expected.has(st)) continue;
  const n = parseInt(f.properties.CD119FP, 10);
  base.set(idFor(st, n || 1), f.geometry);
}
console.log(`  ${base.size} districts`);

const shapes = new Map(base);
const problems = [];
for (const [st, src] of Object.entries(sources.states)) {
  const n = expected.get(st).length;
  try {
    const features = (await load(st, src.url)).filter((f) => f.geometry);
    const found = districtNumbers(features, n);
    console.log(`${st}: ${features.length} features from ${src.url}`);
    console.log(`  fields: ${Object.keys(features[0]?.properties ?? {}).join(", ")}`);
    if (!found) throw new Error(`no field numbers the districts 1-${n} (${features.length} features)`);
    // A district can come in several pieces: merge them into one MultiPolygon.
    const byId = new Map();
    features.forEach((f, i) => {
      const id = idFor(st, found.nums[i]);
      const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
      byId.set(id, [...(byId.get(id) ?? []), ...polys]);
    });
    // Same as the 2024 lines? Compare each district's area and center.
    let same = 0;
    for (const [id, polys] of byId) {
      const g = { type: "MultiPolygon", coordinates: polys };
      const old = base.get(id);
      if (old) {
        const [cx, cy] = centroid(g), [ox, oy] = centroid(old);
        if (Math.abs(area(g) / area(old) - 1) < 0.02 && Math.hypot(cx - ox, cy - oy) < 0.02) same++;
      }
      shapes.set(id, g);
    }
    console.log(`  district number from "${found.key}"; ${same} of ${n} districts look the same as the 2024 lines`);
    if (same === n) problems.push(`${st}: the source matches the 2024 lines; it may not be the new map`);
  } catch (e) {
    problems.push(`${st}: ${e.message} (keeping the 2024 lines)`);
  }
}

// The far Aleutians sit past 180° and can't be projected; drop those islands.
if (shapes.has("AK-AL")) {
  const g = shapes.get("AK-AL");
  const polys = (g.type === "Polygon" ? [g.coordinates] : g.coordinates).filter((p) => p[0].every(([x]) => x < 0));
  shapes.set("AK-AL", { type: "MultiPolygon", coordinates: polys });
}

const missing = forecast.races.map((r) => r.state).filter((id) => !shapes.has(id));
if (missing.length) problems.push(`no shape for ${missing.join(", ")}`);

const combined = `${TMP}/combined.geojson`;
writeFileSync(
  combined,
  JSON.stringify({
    type: "FeatureCollection",
    features: [...shapes].map(([id, geometry]) => ({
      type: "Feature",
      properties: { id, st: id.slice(0, 2), redrawn: id.slice(0, 2) in sources.states },
      geometry,
    })),
  }),
);
mapshaper(
  "-i", combined, "name=districts",
  "-proj", "albersusa",
  "-clean",
  "-simplify", "3%", "keep-shapes",
  "-dissolve", "st", "+", "name=states",
  "-o", OUT, "target=districts,states", "format=topojson", "quantization=20000", "id-field=id,st",
);
console.log(`Wrote ${OUT} (${(readFileSync(OUT).length / 1024).toFixed(0)} KB)`);
if (problems.length) console.log(`\nProblems:\n  ${problems.join("\n  ")}`);
