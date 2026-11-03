// Stress test for the live election model: streams many made-up election
// nights through runModel and scores what it says along the way.
//
// Each night draws a true outcome from the race's final forecast, true county
// turnout (which can run well over or under what the model assumes, and can
// differ between blue and red counties), and a realistic count: each county
// reports its early/mail votes, then Election Day votes (when its precincts
// are all in it is flagged complete), then late mail, at its own pace, with
// the early votes leaning toward one party.
//
// Run: npx jiti scripts/election-stress.ts [scenario] [states] [nights]
//   scenario: base | high | low | diff | slowcity | redfirst | all (default all)
//   states:   comma list (default NC,GA,TX,SC,IA,OH,MI)
// Prints, at points through the count, how far the model's "% counted" is from
// the truth, the projection's error, how often the truth falls in its 90%
// range, and any wrong or premature calls.
import { readFileSync } from "node:fs";
import baselines from "../src/lib/election/baselines.json";
import { ELECTION } from "../src/lib/election/config";
import { priorsFrom } from "../src/lib/election/live";
import { runModel, type CountyCount, type Prior } from "../src/lib/election/model";
import type { Forecast } from "../src/lib/forecast";

type County = { fips: string; name: string; margin: number; votes: number };
const BASE = baselines as Record<string, County[]>;

type Scenario = {
  /** True turnout vs the model's assumption (log scale): mean and spread. */
  turnoutShift: number;
  turnoutSd: number;
  /** Extra log-turnout per 100 points of 2024 margin (+ = blue counties turn out more). */
  partisanTurnout: number;
  /** Points the early/mail batch leans to the opposition vs the county's final. */
  earlyLean: number;
  /** Big counties report later (hours of delay per log10 of 2024 votes over 10k). */
  bigCountyDelay: number;
  /** Late mail after "complete", as a share of the county's vote. */
  lateShare: number;
};

const SCENARIOS: Record<string, Scenario> = {
  // Turnout as assumed (with normal error), mail first leaning blue.
  base: { turnoutShift: 0, turnoutSd: 0.07, partisanTurnout: 0, earlyLean: 8, bigCountyDelay: 0.5, lateShare: 0.03 },
  // Turnout 15% over what the model assumes, everywhere.
  high: { turnoutShift: 0.14, turnoutSd: 0.03, partisanTurnout: 0, earlyLean: 8, bigCountyDelay: 0.5, lateShare: 0.03 },
  // Turnout 15% under.
  low: { turnoutShift: -0.16, turnoutSd: 0.03, partisanTurnout: 0, earlyLean: 8, bigCountyDelay: 0.5, lateShare: 0.03 },
  // Blue counties turn out more than red ones (and over the assumption overall).
  diff: { turnoutShift: 0.06, turnoutSd: 0.03, partisanTurnout: 0.25, earlyLean: 8, bigCountyDelay: 0.5, lateShare: 0.03 },
  // Big cities count slowly and run well over turnout.
  slowcity: { turnoutShift: 0.1, turnoutSd: 0.03, partisanTurnout: 0.15, earlyLean: 6, bigCountyDelay: 2, lateShare: 0.06 },
  // Election Day votes first: early batch leans red.
  redfirst: { turnoutShift: 0, turnoutSd: 0.07, partisanTurnout: 0, earlyLean: -8, bigCountyDelay: 0.5, lateShare: 0.03 },
};

const args = process.argv.slice(2);
const which = args[0] && args[0] !== "all" ? [args[0]] : Object.keys(SCENARIOS);
const states = (args[1] ?? "NC,GA,TX,SC,IA,OH,MI").split(",");
const nights = Number(args[2] ?? 40);

if (process.env.CALL_MIN) ELECTION.callMinCounted = Number(process.env.CALL_MIN);
const forecast = JSON.parse(readFileSync(process.env.FORECAST_JSON ?? "/tmp/latest.json", "utf8")) as Forecast;
const priors = new Map(priorsFrom(forecast).map((p) => [p.state, p]));

let seed = 12345;
const uni = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const norm = () => Math.sqrt(-2 * Math.log(uni() || 1e-12)) * Math.cos(2 * Math.PI * uni());

type Batch = { at: number; votes: number; margin: number; completes?: boolean };

function night(state: string, prior: Prior, sc: Scenario) {
  const counties = BASE[state];
  const total24 = counties.reduce((s, c) => s + c.votes, 0);
  const base24 = counties.reduce((s, c) => s + c.margin * c.votes, 0) / total24;
  const assumed = ELECTION.states[state]?.turnout ?? ELECTION.turnout;
  const swing = prior.mean - base24 + prior.sd * norm();
  const stateT = assumed * Math.exp(sc.turnoutShift + sc.turnoutSd * norm());
  const plan = counties.map((c) => {
    const tau = 4 * Math.min(3, Math.max(0.15, Math.sqrt(20000 / c.votes)));
    const margin = c.margin + swing + tau * norm();
    const final = c.votes * stateT * Math.exp(0.08 * norm() + (sc.partisanTurnout * c.margin) / 100);
    const early = 0.35 + 0.3 * uni();
    const late = sc.lateShare * (0.5 + uni());
    const ed = 1 - early - late;
    // Early batch leans earlyLean, the late batch votes like the county as a
    // whole, and Election Day makes up the rest.
    const lean = sc.earlyLean * (0.5 + uni());
    const mEarly = margin + lean * (1 - early);
    const mRest = (margin * (1 - late) - mEarly * early) / ed;
    const start = uni() * 3 + sc.bigCountyDelay * Math.max(0, Math.log10(c.votes / 10000));
    const batches: Batch[] = [];
    // Early votes in 1-2 drops, Election Day in 2-4 drops, late mail much later.
    const nE = 1 + Math.floor(uni() * 2);
    for (let i = 0; i < nE; i++) batches.push({ at: start + i * 0.5, votes: (final * early) / nE, margin: mEarly });
    const nD = 2 + Math.floor(uni() * 3);
    for (let i = 0; i < nD; i++)
      batches.push({ at: start + 1 + i * (0.5 + uni()), votes: (final * ed) / nD, margin: mRest, completes: i === nD - 1 });
    batches.push({ at: start + 8 + uni() * 6, votes: final * late, margin });
    return { c, margin, final, batches };
  });
  const finalVotes = plan.reduce((s, p) => s + p.final, 0);
  const truth = plan.reduce((s, p) => s + p.margin * p.final, 0) / finalVotes;
  return { plan, finalVotes, truth };
}

function countsAt(n: ReturnType<typeof night>, t: number): { counts: CountyCount[]; counted: number } {
  let counted = 0;
  const counts: CountyCount[] = [];
  for (const p of n.plan) {
    let opp = 0;
    let rep = 0;
    let other = 0;
    let complete = false;
    for (const b of p.batches) {
      if (b.at > t) continue;
      const o = b.votes * 0.02;
      const two = b.votes - o;
      opp += two * Math.min(1, Math.max(0, 0.5 + b.margin / 200));
      rep += two * Math.min(1, Math.max(0, 0.5 - b.margin / 200));
      other += o;
      if (b.completes) complete = true;
    }
    if (opp + rep + other <= 0) continue;
    counted += opp + rep + other;
    counts.push({ name: p.c.name, fips: p.c.fips, opp, rep, other, complete });
  }
  return { counts, counted };
}

const CHECKS = [0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9, 0.97];

for (const name of which) {
  const sc = SCENARIOS[name];
  console.log(`\n=== ${name} ${JSON.stringify(sc)}`);
  for (const state of states) {
    const prior = priors.get(state)!;
    const rows = CHECKS.map(() => ({ n: 0, cntErr: 0, err: 0, absErr: 0, inside: 0, brier: 0 }));
    let wrongCalls = 0;
    let calls = 0;
    let callAtTrue = 0;
    let finalCountedShown = 0;
    for (let k = 0; k < nights; k++) {
      const n = night(state, prior, sc);
      let ci = 0;
      let calledNight: string | null = null;
      for (let t = 0; t <= 24 && ci < CHECKS.length; t += 0.25) {
        const { counts, counted } = countsAt(n, t);
        const share = counted / n.finalVotes;
        const atCheck = share >= CHECKS[ci];
        if (!atCheck && !calledNight && counts.length === 0) continue;
        const { races } = runModel({ priors: [prior], counts: { [state]: counts }, closed: new Set([state]) });
        const r = races[0];
        if (r.called && !calledNight) {
          calledNight = r.called;
          calls++;
          callAtTrue += share;
          if ((r.called === "opp") !== n.truth > 0) {
            wrongCalls++;
            console.log(`  WRONG CALL ${state} night ${k}: called ${r.called} at ${(share * 100).toFixed(0)}% true counted, truth ${n.truth.toFixed(1)}`);
          }
        }
        while (ci < CHECKS.length && share >= CHECKS[ci]) {
          const row = rows[ci];
          row.n++;
          row.cntErr += r.counted - share;
          row.err += r.margin.mean - n.truth;
          row.absErr += Math.abs(r.margin.mean - n.truth);
          if (n.truth >= r.margin.p5 && n.truth <= r.margin.p95) row.inside++;
          row.brier += (r.pOpp - (n.truth > 0 ? 1 : 0)) ** 2;
          ci++;
        }
      }
      const end = runModel({ priors: [prior], counts: { [state]: countsAt(n, 99).counts }, closed: new Set([state]) }).races[0];
      finalCountedShown += end.counted;
    }
    console.log(
      `${state} (forecast ${prior.mean.toFixed(1)}±${prior.sd.toFixed(1)}): calls ${calls}/${nights}, wrong ${wrongCalls}, ` +
        `called at ${calls ? ((callAtTrue / calls) * 100).toFixed(0) : "-"}% true counted, shows ${((finalCountedShown / nights) * 100).toFixed(0)}% at the end`,
    );
    console.log("   true%  counted-err  proj-bias  proj-|err|  in-90%  brier");
    rows.forEach((row, i) => {
      if (!row.n) return;
      const f = (x: number, d = 1) => (x / row.n).toFixed(d).padStart(9);
      console.log(
        `   ${String(CHECKS[i] * 100).padStart(4)}  ${((row.cntErr / row.n) * 100).toFixed(1).padStart(9)}pt ${f(row.err)} ${f(row.absErr)}  ${((row.inside / row.n) * 100).toFixed(0).padStart(5)}%  ${f(row.brier, 3)}`,
      );
    });
  }
}
