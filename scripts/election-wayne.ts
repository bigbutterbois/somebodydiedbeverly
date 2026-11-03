// Checks how a partial Wayne County count moves Michigan's projection when
// the votes in are only suburbs, only Detroit, or a mix. Other counties are
// half counted at the true swing.
// Run: npx jiti scripts/election-wayne.ts
import baselines from "../src/lib/election/baselines.json";
import { runModel, type CountyCount } from "../src/lib/election/model";

const counties = (baselines as Record<string, { fips: string; name: string; margin: number; votes: number }[]>).MI;
const swing = 3;
const T = 0.82;
const det = { votes: 246303, margin: 82.0 };
const wayne = counties.find((c) => c.name === "Wayne")!;
const rest = { votes: wayne.votes - det.votes, margin: (wayne.margin * wayne.votes - det.margin * det.votes) / (wayne.votes - det.votes) };
const total = counties.reduce((s, c) => s + c.votes, 0);
const truth = counties.reduce((s, c) => s + (c.margin + swing) * c.votes, 0) / total;
const row = (name: string, parts: { votes: number; margin: number }[]): CountyCount => {
  let opp = 0;
  let rep = 0;
  for (const q of parts) {
    const m = q.margin + swing;
    opp += q.votes * (0.5 + m / 200);
    rep += q.votes * (0.5 - m / 200);
  }
  return { name, opp, rep, other: 0 };
};
const cases: [string, { votes: number; margin: number }[]][] = [
  ["no Wayne votes", []],
  ["suburbs 50% in", [{ votes: rest.votes * T * 0.5, margin: rest.margin }]],
  ["Detroit 50% in", [{ votes: det.votes * T * 0.5, margin: det.margin }]],
  ["both 40% in", [{ votes: rest.votes * T * 0.4, margin: rest.margin }, { votes: det.votes * T * 0.4, margin: det.margin }]],
  ["suburbs all in, no Detroit", [{ votes: rest.votes * T, margin: rest.margin }]],
];
console.log(`MI truth ${truth.toFixed(1)}; others half counted`);
for (const [label, parts] of cases) {
  const counts = counties
    .filter((c) => c.name !== "Wayne")
    .map((c) => row(c.name, [{ votes: c.votes * T * 0.5, margin: c.margin }]));
  if (parts.length) counts.push(row("Wayne", parts));
  const r = runModel({ priors: [{ state: "MI", name: "MI", mean: truth, sd: 5.3, pOpp: 0.7 }], counts: { MI: counts }, closed: new Set(["MI"]) }).races[0];
  console.log(`${label.padEnd(28)} proj ${r.margin.mean.toFixed(1).padStart(5)} [${r.margin.p5.toFixed(1)}, ${r.margin.p95.toFixed(1)}]  p(opp) ${(r.pOpp * 100).toFixed(0)}%`);
}
