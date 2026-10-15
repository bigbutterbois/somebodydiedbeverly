// Builds the faint county outlines behind the to-scale Metro map: DC and the
// Maryland and Virginia counties Metrorail reaches, from the us-atlas package
// (no download needed). Writes src/app/(site)/metro/map/backdrop.json:
//
//   node scripts/metro-backdrop.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { feature } from "topojson-client";

const OUT = "src/app/(site)/metro/map/backdrop.json";
const COUNTIES = {
  "11001": "District of Columbia",
  "24031": "Montgomery",
  "24033": "Prince George's",
  "51013": "Arlington",
  "51059": "Fairfax",
  "51107": "Loudoun",
  "51510": "Alexandria",
  "51600": "Fairfax City",
  "51610": "Falls Church",
};

const topo = JSON.parse(readFileSync("node_modules/us-atlas/counties-10m.json", "utf8"));
const round = (c) => (typeof c[0] === "number" ? [+c[0].toFixed(4), +c[1].toFixed(4)] : c.map(round));
const features = feature(topo, topo.objects.counties)
  .features.filter((f) => COUNTIES[f.id])
  .map((f) => ({
    type: "Feature",
    id: f.id,
    properties: { name: COUNTIES[f.id] },
    geometry: { type: f.geometry.type, coordinates: round(f.geometry.coordinates) },
  }));
writeFileSync(OUT, JSON.stringify({ type: "FeatureCollection", features }) + "\n");
console.log(`${features.length} counties → ${OUT}`);
