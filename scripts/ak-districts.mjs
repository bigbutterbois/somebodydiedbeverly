// Builds src/lib/election/ak-districts.json: Alaska's 40 state House districts
// as SVG paths in the same Albers USA frame as us-atlas (975 x 610), keyed by
// the baseline fips (02001-02040), for Admin → Election → Swing map.
//
//   curl -sSLO https://www2.census.gov/geo/tiger/GENZ2024/shp/cb_2024_02_sldl_500k.zip
//   unzip cb_2024_02_sldl_500k.zip -d ak
//   npm i --no-save shapefile
//   node scripts/ak-districts.mjs ak/cb_2024_02_sldl_500k.shp
import { writeFileSync } from "node:fs";
import { geoAlbersUsa, geoPath } from "d3-geo";
import { read } from "shapefile";

const fc = await read(process.argv[2], process.argv[2].replace(/\.shp$/, ".dbf"));
// us-atlas's projection, so the districts sit exactly where Alaska's counties do.
const path = geoPath(geoAlbersUsa().scale(1300).translate([487.5, 305])).digits(1);
// Alaska is drawn small, so keep only points at least MIN pixels from the last
// one kept in each ring (rings that shrink below three points are dropped;
// the tiny Anchorage districts get a finer pass instead).
const MIN = 0.35;
function thin(d, min = MIN) {
  return d
    .split("M")
    .filter(Boolean)
    .map((ring) => {
      const pts = ring.replace(/Z$/, "").split("L").map((p) => p.split(",").map(Number));
      const kept = [pts[0]];
      for (const p of pts.slice(1)) {
        const q = kept[kept.length - 1];
        if (Math.hypot(p[0] - q[0], p[1] - q[1]) >= min) kept.push(p);
      }
      return kept.length < 3 ? "" : `M${kept.map((p) => p.join(",")).join("L")}Z`;
    })
    .join("");
}

const out = {};
for (const f of fc.features) {
  const n = Number(f.properties.SLDLST);
  if (!(n >= 1 && n <= 40)) continue;
  out[`020${String(n).padStart(2, "0")}`] = thin(path(f) ?? "") || thin(path(f) ?? "", 0.05);
}
writeFileSync(new URL("../src/lib/election/ak-districts.json", import.meta.url), JSON.stringify(out) + "\n");
console.log(Object.keys(out).length, "districts,", JSON.stringify(out).length, "bytes");
