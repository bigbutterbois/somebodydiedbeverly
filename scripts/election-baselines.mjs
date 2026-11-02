// Builds src/lib/election/baselines.json: every county (Alaska: state House
// district) in each state with a 2026 Senate race, with its 2024 presidential
// margin and vote total. The live election model measures each county's swing
// against these and uses the totals to estimate how many votes are left.
//
//   curl -sSLO https://raw.githubusercontent.com/tonmcg/US_County_Level_Election_Results_08-24/master/2024_US_County_Level_Presidential_Results.csv
//   node scripts/election-baselines.mjs 2024_US_County_Level_Presidential_Results.csv
import { readFileSync, writeFileSync } from "node:fs";

const csv = readFileSync(process.argv[2], "utf8").trim().split("\n");
const races = readFileSync(new URL("../forecast/races.yaml", import.meta.url), "utf8");
const states = new Map([...races.matchAll(/state: (\w\w), name: ([^,]+),/g)].map((m) => [m[2], m[1]]));

const out = {};
for (const line of csv.slice(1)) {
  const [state, fips, name, gop, dem, total] = line.split(",");
  const code = states.get(state);
  if (!code) continue;
  const t = Number(total);
  (out[code] ??= []).push({
    fips,
    name: name.replace(/ (County|Parish)$/, ""),
    margin: Math.round(((Number(dem) - Number(gop)) / t) * 1000) / 10,
    votes: t,
  });
}
writeFileSync(new URL("../src/lib/election/baselines.json", import.meta.url), JSON.stringify(out) + "\n");
console.log(Object.entries(out).map(([s, c]) => `${s} ${c.length}`).join(", "));
