// The live election night model. It starts from the final forecast for each
// Senate race and moves with the county results as they come in.
//
// For each county we know its 2024 presidential margin and vote total
// (baselines.json). The race's "swing" is how far this year's margin runs
// ahead of or behind 2024. Before any votes, the swing comes from the forecast
// (its mean margin minus the state's 2024 margin). As counties report, each
// one's own swing is a noisy reading of the statewide swing: noisier when the
// county is small (its own quirks) and when only part of it is counted (early
// and mail votes don't vote like Election Day votes). The model blends those
// readings with the forecast, then fills in each county's uncounted votes at
// its 2024 margin plus the swing, and simulates the leftover uncertainty
// (swing, turnout, vote type) to get win odds and a range for the final
// margin. Margins are always opposition minus Republican, in points.
//
// Pure functions only, so the same code runs on the server and in the replay
// test (scripts/election-replay.mjs).

import baselines from "./baselines.json";
import { ELECTION } from "./config";

export type County = { fips: string; name: string; margin: number; votes: number };
const BASELINES = baselines as Record<string, County[]>;

/** One county's (or a statewide pseudo-county's) votes so far, from a results feed. */
export type CountyCount = {
  /** Name as the feed gives it; matched to baselines.json loosely. */
  name: string;
  fips?: string;
  rep: number;
  opp: number;
  other: number;
  /** Every precinct in (more ballots can still come, see lateVotes in config). */
  complete?: boolean;
  /** The feed's own estimate of the county's final vote, used instead of ours when given. */
  expected?: number;
};

export type Prior = {
  state: string;
  name: string;
  mean: number;
  sd: number;
  pOpp: number;
};

export type RaceResult = {
  state: string;
  /** "live" once votes are in, "waiting" before, "forecast" when there is no feed. */
  status: "waiting" | "live" | "forecast";
  votes: { rep: number; opp: number; other: number; total: number };
  /** Estimated share of the final vote counted, 0..1. */
  counted: number;
  pOpp: number;
  /** Projected final margin: mean and the 5/25/75/95th percentiles. */
  margin: { mean: number; p5: number; p25: number; p75: number; p95: number };
  /** Chance nobody passes 50% (Georgia goes to a runoff). */
  pRunoff?: number;
  called: "opp" | "rep" | null;
  /** Counties with any votes, and all counties. */
  counties: { reporting: number; total: number };
  /** Feed counties that matched no baseline county (fix the name mapping). */
  unmatched?: string[];
};

// ---------------------------------------------------------------------------

/** Seeded random numbers, so a refresh with no new votes gives the same answer. */
function rng(seed: number) {
  let a = seed >>> 0;
  const uniform = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let spare: number | null = null;
  const normal = () => {
    if (spare !== null) {
      const s = spare;
      spare = null;
      return s;
    }
    let u = 0;
    while (u === 0) u = uniform();
    const v = uniform();
    const r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  };
  return { uniform, normal };
}

export function normName(name: string) {
  const n = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(county|parish|borough|city and county)\b/g, "")
    .replace(/\bst\.?\s/g, "saint ")
    .replace(/\bste\.?\s/g, "sainte ")
    .replace(/[^a-z0-9]/g, "");
  // Alaska reports by state House district: "District 7", "HD 07", "State House District 7".
  const district = n.match(/^(?:statehouse)?(?:district|hd)0*(\d+)$/);
  return district ? `district${district[1]}` : n;
}

function quantile(sorted: Float64Array, q: number) {
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

const round1 = (x: number) => Math.round(x * 10) / 10;

type Prepared = {
  prior: Prior;
  counties: {
    base: County;
    count: CountyCount | null;
    expected: number;
    tau: number;
  }[];
  /** 2024 presidential margin statewide. */
  base2024: number;
  unmatched: string[];
};

function prepare(prior: Prior, counts: CountyCount[] | null): Prepared {
  const cfg = ELECTION.states[prior.state] ?? {};
  const turnout = cfg.turnout ?? ELECTION.turnout;
  const base = BASELINES[prior.state] ?? [];
  const total24 = base.reduce((s, c) => s + c.votes, 0);
  const base2024 = base.reduce((s, c) => s + c.margin * c.votes, 0) / Math.max(total24, 1);

  // A feed with one statewide row is modeled as one big county.
  const statewide = counts?.length === 1 && /^(statewide|state|total)$/i.test(counts[0].name.trim());
  const units: County[] = statewide
    ? [{ fips: prior.state, name: "Statewide", margin: base2024, votes: total24 }]
    : base;

  const byKey = new Map<string, CountyCount>();
  const unmatched: string[] = [];
  if (counts) {
    const fipsSet = new Set(units.map((u) => u.fips));
    const nameSet = new Set(units.map((u) => normName(u.name)));
    for (const c of counts) {
      if (statewide) byKey.set(prior.state, c);
      else if (c.fips && fipsSet.has(c.fips)) byKey.set(c.fips, c);
      else if (nameSet.has(normName(c.name))) byKey.set(normName(c.name), c);
      else if (c.rep + c.opp + c.other > 0) unmatched.push(c.name);
    }
  }

  return {
    prior,
    base2024,
    unmatched,
    counties: units.map((u) => {
      const count = statewide ? byKey.get(prior.state) ?? null : byKey.get(u.fips) ?? byKey.get(normName(u.name)) ?? null;
      const counted = count ? count.rep + count.opp + count.other : 0;
      let expected = count?.expected && count.expected > 0 ? count.expected : u.votes * turnout;
      if (count?.complete) expected = counted * (1 + (cfg.lateVotes ?? ELECTION.lateVotes));
      // Never expect fewer votes than are already counted.
      expected = Math.max(expected, counted * (count?.complete ? 1 : 1.02));
      const tau = ELECTION.countyNoise * Math.min(3, Math.max(0.15, Math.sqrt(ELECTION.countyNoiseVotes / Math.max(u.votes, 1))));
      return { base: u, count, expected, tau };
    }),
  };
}

/** Learns this year's turnout from finished counties, so % counted improves through the night. */
function refreshTurnout(p: Prepared) {
  const cfg = ELECTION.states[p.prior.state] ?? {};
  const assumed = cfg.turnout ?? ELECTION.turnout;
  let done = 0;
  let done24 = 0;
  for (const c of p.counties) {
    if (c.count?.complete) {
      done += c.count.rep + c.count.opp + c.count.other;
      done24 += c.base.votes;
    }
  }
  if (done24 === 0) return;
  // Shrink toward the assumed ratio until a good share of the state is done.
  const all24 = p.counties.reduce((s, c) => s + c.base.votes, 0);
  const w = Math.min(1, (done24 / all24) * 2);
  const ratio = (1 - w) * assumed + (w * done) / done24;
  for (const c of p.counties) {
    if (c.count?.complete || c.count?.expected) continue;
    const counted = c.count ? c.count.rep + c.count.opp + c.count.other : 0;
    c.expected = Math.max(c.base.votes * ratio, counted * 1.02);
  }
}

// Two unknowns are estimated together: S, the statewide swing from 2024, and
// B, how far the votes counted early lean from a county's final margin (mail
// first in some states, Election Day first in others). A county with share f
// counted reads as margin = 2024 margin + S + its own quirk + B * (1 - f), so
// B is shared by every partly counted county; that keeps a wave of early mail
// votes from looking like a landslide. The uncounted rest of a county then
// votes at 2024 margin + S + quirk - B * f.
type SwingEstimate = {
  s: number;
  b: number;
  /** Posterior covariance of (S, B). */
  vss: number;
  vsb: number;
  vbb: number;
  priorSwing: number;
  /** Share of the forecast's uncertainty about S that the results have resolved. */
  info: number;
};

function countedShare(c: Prepared["counties"][number]) {
  const v = c.count ? c.count.rep + c.count.opp + c.count.other : 0;
  return { v, f: v > 0 ? Math.min(1, v / c.expected) : 0 };
}

function estimateSwing(p: Prepared, priorShift = 0): SwingEstimate {
  const cfg = ELECTION.states[p.prior.state] ?? {};
  const priorSwing = p.prior.mean - p.base2024 + priorShift;
  // Precision matrix and vector of a 2-parameter Bayesian regression.
  let a11 = 1 / p.prior.sd ** 2;
  let a12 = 0;
  let a22 = 1 / ELECTION.earlyLeanSd ** 2;
  let y1 = priorSwing * a11;
  let y2 = (cfg.earlyLean ?? 0) * a22;
  for (const c of p.counties) {
    const { v, f } = countedShare(c);
    if (!c.count || v <= 0) continue;
    const swing = ((c.count.opp - c.count.rep) / v) * 100 - c.base.margin;
    const x = 1 - f;
    const w = 1 / (c.tau ** 2 + (ELECTION.partialNoise * x) ** 2);
    a11 += w;
    a12 += w * x;
    a22 += w * x * x;
    y1 += w * swing;
    y2 += w * x * swing;
  }
  const det = a11 * a22 - a12 * a12;
  const vss = a22 / det;
  const vsb = -a12 / det;
  const vbb = a11 / det;
  return {
    s: vss * y1 + vsb * y2,
    b: vsb * y1 + vbb * y2,
    vss,
    vsb,
    vbb,
    priorSwing,
    info: 1 - vss / p.prior.sd ** 2,
  };
}

function simulate(p: Prepared, est: SwingEstimate, national: Float64Array, runoffRule: boolean, seed: number) {
  const r = rng(seed);
  const sims = national.length;
  const margins = new Float64Array(sims);
  let oppWins = 0;
  let runoffs = 0;

  let opp0 = 0;
  let rep0 = 0;
  let other0 = 0;
  let expected = 0;
  for (const c of p.counties) {
    expected += c.expected;
    if (c.count) {
      opp0 += c.count.opp;
      rep0 += c.count.rep;
      other0 += c.count.other;
    }
  }
  const counted = opp0 + rep0 + other0;
  const F = expected > 0 ? Math.min(1, counted / expected) : 0;
  // Cholesky factor of the (S, B) covariance.
  const l11 = Math.sqrt(est.vss);
  const l21 = est.vsb / l11;
  const l22 = Math.sqrt(Math.max(est.vbb - l21 * l21, 0));
  const rho = ELECTION.nationalCorrelation;

  const pre = p.counties.map((c) => {
    const { v, f } = countedShare(c);
    const x = 1 - f;
    const swingHere = v > 0 ? ((c.count!.opp - c.count!.rep) / v) * 100 - c.base.margin : 0;
    const partial = (ELECTION.partialNoise * x) ** 2;
    // How much of this county's own quirk its partial count has shown.
    const shown = v > 0 ? c.tau ** 2 / (c.tau ** 2 + partial) : 0;
    const otherShare = v > 0 ? c.count!.other / v : ELECTION.otherShare;
    return {
      done: Boolean(c.count?.complete) && c.expected <= v * 1.0001,
      left: Math.max(c.expected - v, 0),
      f,
      quirk: shown * (swingHere - est.s - est.b * x),
      quirkSd: c.tau * Math.sqrt(1 - shown),
      base: c.base.margin,
      otherShare: Math.min(otherShare, 0.5),
    };
  });

  for (let i = 0; i < sims; i++) {
    const z1 = rho * national[i] + Math.sqrt(1 - rho * rho) * r.normal();
    // modelSlack: room for what this simple model gets wrong, on top of its own uncertainty.
    const S = est.s + l11 * z1 + ELECTION.modelSlack * r.normal();
    const B = est.b + l21 * z1 + l22 * r.normal();
    const turnout = Math.exp(ELECTION.turnoutNoise * r.normal());
    let opp = opp0;
    let rep = rep0;
    let other = other0;
    for (const c of pre) {
      if (c.done || c.left <= 0) continue;
      const left = c.left * turnout * Math.exp(ELECTION.countyTurnoutNoise * r.normal());
      const m = c.base + S + c.quirk - B * c.f + c.quirkSd * r.normal();
      const two = 1 - c.otherShare;
      const oppShare = Math.min(two, Math.max(0, two / 2 + m / 200));
      opp += left * oppShare;
      rep += left * (two - oppShare);
      other += left * c.otherShare;
    }
    const total = opp + rep + other;
    const margin = total > 0 ? ((opp - rep) / total) * 100 : 0;
    margins[i] = margin;
    if (margin > 0) oppWins++;
    if (runoffRule && total > 0 && Math.max(opp, rep) / total < 0.5) runoffs++;
  }
  const sorted = margins.slice().sort();
  let mean = 0;
  for (const m of margins) mean += m;
  mean /= sims;
  return {
    pOpp: oppWins / sims,
    pRunoff: runoffRule ? runoffs / sims : undefined,
    margin: {
      mean: round1(mean),
      p5: round1(quantile(sorted, 0.05)),
      p25: round1(quantile(sorted, 0.25)),
      p75: round1(quantile(sorted, 0.75)),
      p95: round1(quantile(sorted, 0.95)),
    },
    votes: { rep: rep0, opp: opp0, other: other0, total: counted },
    counted: F,
  };
}

export type LiveInput = {
  priors: Prior[];
  /** County counts by state; a state missing here has no feed. */
  counts: Record<string, CountyCount[] | undefined>;
  /** States whose polls have closed. */
  closed: Set<string>;
};

/**
 * Runs every race. Also returns the national signal: how far, in standard
 * deviations, the states with real results are running from their forecasts.
 * States with little data yet get nudged by it, the way an early Georgia
 * count says something about later states.
 */
export function runModel(input: LiveInput) {
  const sims = ELECTION.simulations;
  const r = rng(ELECTION.seed);
  const national = new Float64Array(sims);
  for (let i = 0; i < sims; i++) national[i] = r.normal();

  const prepared = input.priors.map((prior) => {
    const counts = input.counts[prior.state];
    const p = prepare(prior, counts ?? null);
    refreshTurnout(p);
    return { p, hasFeed: counts !== undefined, swing: estimateSwing(p) };
  });

  let zSum = 0;
  let wSum = 0;
  for (const { p, swing } of prepared) {
    if (swing.info < ELECTION.signalMinInfo) continue;
    zSum += (swing.info * (swing.s - swing.priorSwing)) / p.prior.sd;
    wSum += swing.info;
  }
  const signal = wSum > 0 ? zSum / Math.max(wSum, 1) : 0;

  const races: RaceResult[] = prepared.map(({ p, hasFeed, swing }, index) => {
    const state = p.prior.state;
    const hasVotes = p.counties.some((c) => c.count && c.count.rep + c.count.opp + c.count.other > 0);
    // Nudge states that haven't said much yet by the national signal.
    const shift = ELECTION.signalWeight * signal * p.prior.sd * (1 - Math.max(0, swing.info));
    const est = shift !== 0 ? estimateSwing(p, shift) : swing;
    const runoffRule = Boolean(ELECTION.states[state]?.runoff);
    const sim = simulate(p, est, national, runoffRule, ELECTION.seed + index + 1);

    const status: RaceResult["status"] = hasVotes ? "live" : hasFeed ? "waiting" : "forecast";
    // Until votes arrive (and before any national signal), show the forecast's own odds.
    const pOpp = !hasVotes && shift === 0 ? p.prior.pOpp : sim.pOpp;
    const margin = sim.margin;
    const called =
      status === "live" && sim.counted >= ELECTION.callMinCounted && input.closed.has(state)
        ? pOpp >= ELECTION.callAt
          ? "opp"
          : 1 - pOpp >= ELECTION.callAt
            ? "rep"
            : null
        : null;
    return {
      state,
      status,
      votes: sim.votes,
      counted: hasVotes ? Math.min(sim.counted, called ? 1 : 0.99) : 0,
      pOpp,
      margin,
      pRunoff: sim.pRunoff,
      called,
      counties: {
        reporting: p.counties.filter((c) => c.count && c.count.rep + c.count.opp + c.count.other > 0).length,
        total: p.counties.length,
      },
      unmatched: p.unmatched.length ? p.unmatched.slice(0, 20) : undefined,
    };
  });

  return { races, signal: round1(signal * 100) / 100, sims, national };
}

/** Senate control from the races, with the same national draws tying states together. */
export function senateControl(
  races: RaceResult[],
  caucusesD: Record<string, boolean>,
  demSeatsNotUp: number,
  majority = 51,
) {
  // Rebuild each race's draws from its odds: a race is won by the opposition in
  // simulation i when its quantile on the shared national draw says so. This
  // keeps races correlated (a Dem night is a Dem night everywhere) without
  // storing every simulation.
  const sims = ELECTION.simulations;
  const r = rng(ELECTION.seed + 999);
  const counts = new Int32Array(101);
  let demControl = 0;
  const rho = ELECTION.nationalCorrelation;
  for (let i = 0; i < sims; i++) {
    const z = r.normal();
    let dem = demSeatsNotUp;
    for (const race of races) {
      const p = race.called ? (race.called === "opp" ? 1 : 0) : race.pOpp;
      // Correlated threshold draw: race goes to the opposition when the
      // mixed normal falls below its odds' z-score.
      const x = rho * z + Math.sqrt(1 - rho * rho) * r.normal();
      if (x < inverseNormal(p) && caucusesD[race.state]) dem++;
    }
    counts[Math.min(dem, 100)]++;
    // A 50-50 Senate goes to Vice President Vance.
    if (dem >= majority) demControl++;
  }
  let mean = 0;
  const distribution: Record<number, number> = {};
  for (let s = 0; s <= 100; s++) {
    if (!counts[s]) continue;
    distribution[s] = counts[s] / sims;
    mean += (s * counts[s]) / sims;
  }
  return { pDemControl: demControl / sims, demSeatsMean: round1(mean), distribution };
}

/** Acklam's inverse normal CDF; 0 and 1 map to -/+ infinity. */
export function inverseNormal(p: number) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771653, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const low = 0.02425;
  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - low) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const q = p - 0.5;
  const rr = q * q;
  return ((((((a[0] * rr + a[1]) * rr + a[2]) * rr + a[3]) * rr + a[4]) * rr + a[5]) * q) / (((((b[0] * rr + b[1]) * rr + b[2]) * rr + b[3]) * rr + b[4]) * rr + 1);
}
