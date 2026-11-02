// Replays election nights through the live model to check it behaves:
// 2024 presidential county results stand in for the final count, the
// forecast is deliberately off by `miss` points, and counties report in a
// random order with their early votes leaning `early` points from their final
// margin. Run: npx jiti scripts/election-replay.ts [GA] [miss] [early]
import baselines from "../src/lib/election/baselines.json";
import { runModel, type CountyCount } from "../src/lib/election/model";

const state = process.argv[2] ?? "GA";
const miss = Number(process.argv[3] ?? 3);
const early = Number(process.argv[4] ?? 8);
const counties = (baselines as Record<string, { fips: string; name: string; margin: number; votes: number }[]>)[state];
const total = counties.reduce((s, c) => s + c.votes, 0);
const truth = counties.reduce((s, c) => s + c.margin * c.votes, 0) / total;

let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
// Each county starts reporting at a random time; it then counts up over ~3 steps.
const start = new Map(counties.map((c) => [c.fips, rand() * 14]));
console.log(`${state}: final ${truth.toFixed(1)}, forecast ${(truth - miss).toFixed(1)}, early votes lean ${early}`);
for (let t = 0; t <= 20; t++) {
  const counts: CountyCount[] = [];
  for (const c of counties) {
    const f = Math.max(0, Math.min(1, (t - start.get(c.fips)!) / 4));
    if (f <= 0) continue;
    const v = c.votes * 0.72 * f;
    const m = c.margin + early * (1 - f);
    const other = v * 0.02;
    counts.push({ name: c.name, rep: (v - other) * (0.5 - m / 200), opp: (v - other) * (0.5 + m / 200), other, complete: f >= 1 });
  }
  const { races } = runModel({
    priors: [{ state, name: state, mean: truth - miss, sd: 4.5, pOpp: 0.5 }],
    counts: { [state]: counts },
    closed: new Set([state]),
  });
  const r = races[0];
  const reported = r.votes.total ? ((r.votes.opp - r.votes.rep) / r.votes.total) * 100 : 0;
  console.log(
    `t=${String(t).padStart(2)} counted ${(r.counted * 100).toFixed(0).padStart(3)}%  tally ${reported.toFixed(1).padStart(6)}  ` +
      `proj ${r.margin.mean.toFixed(1).padStart(6)} [${r.margin.p5.toFixed(1)}, ${r.margin.p95.toFixed(1)}]  p(opp) ${(r.pOpp * 100).toFixed(1)}%  ${r.called ?? ""}`,
  );
}
