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
    /** What we expected before any votes: 2024 votes times the state's assumed turnout. */
    expected0: number;
    tau: number;
  }[];
  /** 2024 presidential margin statewide. */
  base2024: number;
  unmatched: string[];
  /** Uncertainty left in statewide turnout (log scale), after what the counts have shown. */
  turnoutSd: number;
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
    turnoutSd: ELECTION.turnoutNoise,
    counties: units.map((u) => {
      const count = statewide ? byKey.get(prior.state) ?? null : byKey.get(u.fips) ?? byKey.get(normName(u.name)) ?? null;
      const counted = count ? count.rep + count.opp + count.other : 0;
      const expected0 = u.votes * turnout;
      let expected = count?.expected && count.expected > 0 ? count.expected : expected0;
      if (count?.complete) expected = counted * (1 + (cfg.lateVotes ?? ELECTION.lateVotes));
      // Never expect fewer votes than are already counted.
      expected = Math.max(expected, counted * (count?.complete ? 1 : 1.02));
      const tau = ELECTION.countyNoise * Math.min(3, Math.max(0.15, Math.sqrt(ELECTION.countyNoiseVotes / Math.max(u.votes, 1))));
      return { base: u, count, expected, expected0, tau };
    }),
  };
}

const normalPdf = (z: number) => Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
/** Standard normal upper tail, 1 - CDF (Abramowitz-Stegun 7.1.26 via erfc). */
function upperTail(z: number) {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erfc = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-x * x);
  return z >= 0 ? erfc / 2 : 1 - erfc / 2;
}
/** Inverse Mills ratio: the mean of a standard normal above z, E[Z | Z > z]. */
function millsAbove(z: number) {
  if (z > 6) return z + 1 / z;
  const tail = upperTail(z);
  return tail > 1e-300 ? normalPdf(z) / tail : z + 1 / Math.max(z, 1e-9);
}

/**
 * Learns this year's turnout from the counts, live, so a state's expected
 * vote (and so its % counted) moves as counties come in over or under what
 * we expected for them.
 *
 * Each county's final vote is its expected vote times a turnout factor; on
 * the log scale that factor is a statewide level, plus a tilt with the
 * county's 2024 margin (blue counties can turn out more than red ones, or
 * less), plus the county's own noise. A finished county shows its factor
 * outright. A county still counting shows only a floor: its final vote is at
 * least what's counted, so one already past its expected vote says turnout
 * is up, while one a third of the way in says nothing yet. The level and tilt
 * are fit to all of that at once (a censored regression, by EM), starting
 * from the assumed turnout, and every county not finished gets its expected
 * vote from the fit.
 */
function learnTurnout(p: Prepared) {
  const cfg = ELECTION.states[p.prior.state] ?? {};
  const late = cfg.lateVotes ?? ELECTION.lateVotes;
  type Obs = { c: Prepared["counties"][number]; x: number; sd: number; y: number; exact: boolean };
  const obs: Obs[] = [];
  for (const c of p.counties) {
    const v = c.count ? c.count.rep + c.count.opp + c.count.other : 0;
    const x = c.base.margin / 100;
    const sd = ELECTION.countyTurnoutNoise * Math.min(2, Math.max(0.5, Math.sqrt(ELECTION.countyNoiseVotes / Math.max(c.base.votes, 1))));
    if (c.count?.expected && c.count.expected > 0) {
      // The feed's own estimate stands; it also tells us about turnout.
      obs.push({ c, x, sd, y: Math.log(Math.max(c.count.expected, v) / c.expected0), exact: true });
    } else if (c.count?.complete && v > 0) {
      obs.push({ c, x, sd, y: Math.log((v * (1 + late)) / c.expected0), exact: true });
    } else if (v > 0) {
      obs.push({ c, x, sd, y: Math.log((v * 1.02) / c.expected0), exact: false });
    }
  }
  if (!obs.length) return;

  const pa = 1 / ELECTION.turnoutNoise ** 2;
  const pg = 1 / ELECTION.turnoutTiltSd ** 2;
  let a = 0;
  let g = 0;
  // Information matrix (for the uncertainty), rebuilt each pass.
  let i11 = pa;
  let i12 = 0;
  let i22 = pg;
  for (let iter = 0; iter < 30; iter++) {
    let a11 = pa;
    let a12 = 0;
    let a22 = pg;
    let b1 = 0;
    let b2 = 0;
    i11 = pa;
    i12 = 0;
    i22 = pg;
    for (const o of obs) {
      const w = 1 / o.sd ** 2;
      const mu = a + g * o.x;
      let y = o.y;
      let info = 1;
      if (!o.exact) {
        const z = (o.y - mu) / o.sd;
        const lam = millsAbove(z);
        y = mu + o.sd * lam;
        info = Math.min(1, Math.max(0, lam * (lam - z)));
      }
      a11 += w;
      a12 += w * o.x;
      a22 += w * o.x * o.x;
      b1 += w * y;
      b2 += w * o.x * y;
      i11 += w * info;
      i12 += w * info * o.x;
      i22 += w * info * o.x * o.x;
    }
    const det = a11 * a22 - a12 * a12;
    const na = (a22 * b1 - a12 * b2) / det;
    const ng = (a11 * b2 - a12 * b1) / det;
    const moved = Math.abs(na - a) + Math.abs(ng - g);
    a = na;
    g = ng;
    if (moved < 1e-5) break;
  }
  const idet = i11 * i22 - i12 * i12;
  // Turnout still unknown statewide: the level's uncertainty, never quite zero.
  p.turnoutSd = Math.max(Math.sqrt(i22 / idet), 0.01);

  const exact = new Set(obs.filter((o) => o.exact).map((o) => o.c));
  for (const c of p.counties) {
    if (exact.has(c)) continue;
    const v = c.count ? c.count.rep + c.count.opp + c.count.other : 0;
    const x = c.base.margin / 100;
    const mu = a + g * x;
    let y = mu;
    if (v > 0) {
      const sd = ELECTION.countyTurnoutNoise * Math.min(2, Math.max(0.5, Math.sqrt(ELECTION.countyNoiseVotes / Math.max(c.base.votes, 1))));
      const floor = Math.log((v * 1.02) / c.expected0);
      y = mu + sd * millsAbove((floor - mu) / sd);
    }
    c.expected = Math.max(c.expected0 * Math.exp(y), v * 1.02);
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

/**
 * A county with a city that reports on its own (Detroit in Wayne), part
 * counted: guesses how much of the count is the city from how blue it is,
 * given the statewide swing, and returns the 2024 margin of the votes still
 * to come (more city left means bluer). The county's partial count then
 * stays out of the swing estimate, since its margin mostly says which part
 * reported. Null for any other county, or once it has finished.
 */
function splitRemainder(p: Prepared, c: Prepared["counties"][number], s: number, b: number) {
  const split = ELECTION.splitCounties[p.prior.state]?.[c.base.name];
  if (!split || !c.count || c.count.complete) return null;
  const { v, f } = countedShare(c);
  if (v <= 0) return null;
  const restVotes = c.base.votes - split.votes;
  if (restVotes <= 0) return null;
  const restMargin = (c.base.margin * c.base.votes - split.margin * split.votes) / restVotes;
  const seen = ((c.count.opp - c.count.rep) / v) * 100 - s - b * (1 - f);
  const cityShare = Math.min(1, Math.max(0, (seen - restMargin) / (split.margin - restMargin)));
  const cityExpected = (c.expected * split.votes) / c.base.votes;
  const cityLeft = Math.max(cityExpected - cityShare * v, 0);
  const restLeft = Math.max(c.expected - cityExpected - (1 - cityShare) * v, 0);
  const left = cityLeft + restLeft;
  return {
    cityShare,
    base: left > 0 ? (cityLeft * split.margin + restLeft * restMargin) / left : c.base.margin,
  };
}

const isSplitPartial = (p: Prepared, c: Prepared["counties"][number]) =>
  Boolean(ELECTION.splitCounties[p.prior.state]?.[c.base.name] && c.count && !c.count.complete);

/** Share of the state's expected vote counted so far. */
/** Share of the expected vote that sits in counties marked finished. */
function finishedShare(p: Prepared) {
  let done = 0;
  let expected = 0;
  for (const c of p.counties) {
    expected += c.expected;
    if (c.count?.complete) done += c.count.rep + c.count.opp + c.count.other;
  }
  return expected > 0 ? Math.min(1, done / expected) : 0;
}

/**
 * How sure the forecast was going in, from 0 (a tossup, or under
 * callCloseOdds) to 1 (callSafeOdds or more), and so how much counted vote a
 * call needs (Mike's rule): safe races from callMinCounted (10%), close ones
 * from callCloseCounted (50%), the rest in between. A race running well off
 * its forecast (callWayOffSd forecast sds) is treated as close.
 */
export function callNeeds(prior: Prior, projected: number | null) {
  const sure = Math.max(prior.pOpp, 1 - prior.pOpp);
  let t = Math.min(1, Math.max(0, (sure - ELECTION.callCloseOdds) / (ELECTION.callSafeOdds - ELECTION.callCloseOdds)));
  if (projected !== null && Math.abs(projected - prior.mean) > ELECTION.callWayOffSd * prior.sd) t = 0;
  const mirage = Boolean(ELECTION.states[prior.state]?.earlyLean);
  return {
    counted: ELECTION.callCloseCounted - (ELECTION.callCloseCounted - ELECTION.callMinCounted) * t,
    // Where the first votes counted lean one way (a mirage), the closer half
    // of races also wait for some counties to finish, so Election Day votes
    // are in the read.
    finished: mirage && t < 0.5 ? ELECTION.callMinFinished : 0,
  };
}

function callReady(p: Prepared, counted: number, projected: number) {
  const need = callNeeds(p.prior, projected);
  return (
    counted >= need.counted &&
    finishedShare(p) >= need.finished &&
    // A race this close waits for nearly every vote: the model's range runs narrow late in the count.
    (Math.abs(projected) >= ELECTION.closeCallMargin || counted >= ELECTION.closeCallCounted)
  );
}

function stateCounted(p: Prepared) {
  let counted = 0;
  let expected = 0;
  for (const c of p.counties) {
    expected += c.expected;
    if (c.count) counted += c.count.rep + c.count.opp + c.count.other;
  }
  return expected > 0 ? Math.min(1, counted / expected) : 0;
}

/**
 * How much the final forecast still counts (Mike's rule): all of it with
 * nothing counted, falling in a straight line to none once half the expected
 * vote is in.
 */
export const forecastWeight = (counted: number) => Math.max(0, 1 - counted / ELECTION.forecastFadeAt);

function estimateSwing(p: Prepared, priorShift = 0): SwingEstimate {
  const priorSwing = p.prior.mean - p.base2024 + priorShift;
  const live = readResults(p, priorSwing);
  // Blend the forecast's swing with what the counted votes alone say.
  const w = forecastWeight(stateCounted(p));
  const vPrior = p.prior.sd ** 2;
  // Mix the two uncertainties in proportion rather than as independent
  // estimates, which made the range shrink faster than the forecast faded.
  const vss = w * vPrior + (1 - w) * live.vss;
  return {
    s: w * priorSwing + (1 - w) * live.s,
    b: live.b,
    vss,
    vsb: (1 - w) * live.vsb,
    vbb: live.vbb,
    priorSwing,
    info: Math.max(0, 1 - vss / vPrior),
  };
}

/** The swing and early-vote lean the counted votes point to on their own (an almost flat prior on the swing). */
function readResults(p: Prepared, priorSwing: number) {
  const cfg = ELECTION.states[p.prior.state] ?? {};
  // Precision matrix and vector of a 2-parameter Bayesian regression.
  let a11 = 1 / ELECTION.flatSwingSd ** 2;
  let a12 = 0;
  let a22 = 1 / ELECTION.earlyLeanSd ** 2;
  let y1 = priorSwing * a11;
  let y2 = (cfg.earlyLean ?? 0) * a22;
  for (const c of p.counties) {
    const { v, f } = countedShare(c);
    if (!c.count || v <= 0 || isSplitPartial(p, c)) continue;
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
  return { s: vss * y1 + vsb * y2, b: vsb * y1 + vbb * y2, vss, vsb, vbb };
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
    const split = splitRemainder(p, c, est.s, est.b);
    return {
      done: Boolean(c.count?.complete) && c.expected <= v * 1.0001,
      left: Math.max(c.expected - v, 0),
      f,
      quirk: split ? 0 : shown * (swingHere - est.s - est.b * x),
      quirkSd: split ? c.tau : c.tau * Math.sqrt(1 - shown),
      base: split ? split.base : c.base.margin,
      otherShare: Math.min(otherShare, 0.5),
    };
  });

  for (let i = 0; i < sims; i++) {
    const z1 = rho * national[i] + Math.sqrt(1 - rho * rho) * r.normal();
    // modelSlack: room for what this simple model gets wrong, on top of its own uncertainty.
    const S = est.s + l11 * z1 + ELECTION.modelSlack * r.normal();
    const B = est.b + l21 * z1 + l22 * r.normal();
    const turnout = Math.exp(p.turnoutSd * r.normal());
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
    learnTurnout(p);
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
  // Each state is nudged only by the *other* states (leave-one-out), so its own
  // votes don't count twice: once in its own read and again through the signal.
  const signalWithout = (p: Prepared, swing: SwingEstimate) => {
    if (swing.info < ELECTION.signalMinInfo) return signal;
    const z = zSum - (swing.info * (swing.s - swing.priorSwing)) / p.prior.sd;
    const w = wSum - swing.info;
    return w > 1e-9 ? z / Math.max(w, 1) : 0;
  };

  const races: RaceResult[] = prepared.map(({ p, hasFeed, swing }, index) => {
    const state = p.prior.state;
    const hasVotes = p.counties.some((c) => c.count && c.count.rep + c.count.opp + c.count.other > 0);
    // Nudge states that haven't said much yet by the national signal.
    const shift = ELECTION.signalWeight * signalWithout(p, swing) * p.prior.sd * (1 - Math.max(0, swing.info));
    const est = shift !== 0 ? estimateSwing(p, shift) : swing;
    const runoffRule = Boolean(ELECTION.states[state]?.runoff);
    const sim = simulate(p, est, national, runoffRule, ELECTION.seed + index + 1);

    const status: RaceResult["status"] = hasVotes ? "live" : hasFeed ? "waiting" : "forecast";
    // Until votes arrive (and before any national signal), show the forecast's own odds.
    const asForecast = !hasVotes && shift === 0;
    const pOpp = asForecast ? p.prior.pOpp : sim.pOpp;
    // Likewise the margin: centre the simulated range on the forecast's own mean
    // so the two pages agree to the decimal (the simulation alone lands a tenth
    // or two off from random noise).
    const d = asForecast ? p.prior.mean - sim.margin.mean : 0;
    const margin = d
      ? {
          mean: round1(p.prior.mean),
          p5: round1(sim.margin.p5 + d),
          p25: round1(sim.margin.p25 + d),
          p75: round1(sim.margin.p75 + d),
          p95: round1(sim.margin.p95 + d),
        }
      : sim.margin;
    const called =
      status === "live" && input.closed.has(state) && callReady(p, sim.counted, sim.margin.mean)
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

/** One row of the admin county sheet. Shares are percent of all votes; margins are opposition minus Republican, in points. */
export type CountyRow = {
  name: string;
  fips: string;
  margin2024: number;
  /** The county's 2024 vote. */
  votes2024: number;
  expectedVotes: number;
  /** What the final forecast implies here: 2024 margin moved by the forecast's statewide swing. */
  expected: { opp: number; rep: number; other: number; margin: number };
  /** What a dead-even state needs here: 2024 margin moved by the swing that makes the state 50/50. */
  breakeven: { opp: number; rep: number; margin: number };
  live: { opp: number; rep: number; other: number; total: number; counted: number; complete: boolean; margin: number | null };
  /** Live margin minus the expected and breakeven margins (+ = opposition doing better). */
  vsExpected: number | null;
  vsBreakeven: number | null;
  /** The county's projected final margin and vote, counted votes plus the model's guess for the rest. */
  projected: { margin: number; votes: number };
};

export type CountySheet = {
  state: string;
  margin2024: number;
  forecastMargin: number;
  /** Statewide swing from 2024: the forecast's, and the one that makes the state 50/50. */
  forecastSwing: number;
  breakevenSwing: number;
  /** The swing and early-vote lean the model is using now. */
  swing: number;
  earlyLean: number;
  expectedVotes: number;
  counted: number;
  forecastWeight: number;
  /** Vote-weighted live margin minus expected / breakeven, over counties with votes. */
  vsExpected: number | null;
  vsBreakeven: number | null;
  unmatched: string[];
  /** How the early-vote assumption is playing out (admin box at the top of the state page). */
  earlyCheck: EarlyCheck;
  rows: CountyRow[];
};

export type EarlyCheck = {
  /** The state's early-vote lean setting, and the lean the model reads now. */
  assumedLean: number;
  learnedLean: number;
  /**
   * Counted votes in counties still counting, against what the model
   * expected them to look like at this stage (forecast plus the assumed
   * lean), vote-weighted: + = bluer (opposition) than expected. Null with no
   * such votes.
   */
  partialVsExpected: number | null;
  partialShare: number;
  /** Of that surprise: how much the model reads as real swing, and how much as a bigger (or smaller) early lean. */
  asSwing: number;
  asLean: number;
  /** Finished counties against the forecast, and their share of the expected vote. */
  finishedVsForecast: number | null;
  finishedShare: number;
  finishedCount: number;
  /** What a call needs now, given the forecast odds and the projection. */
  callNeeds: { counted: number; finished: number };
};

const shares = (margin: number, other: number) => {
  const two = 100 - other;
  const opp = Math.min(two, Math.max(0, two / 2 + margin / 2));
  return { opp: round1(opp), rep: round1(two - opp), other: round1(other) };
};

/** The admin county sheet for one race: expectations filled in before the night, live numbers as they arrive. */
export function countySheet(prior: Prior, counts: CountyCount[] | null): CountySheet {
  const p = prepare(prior, counts);
  learnTurnout(p);
  const est = estimateSwing(p);
  const forecastSwing = prior.mean - p.base2024;
  const breakevenSwing = -p.base2024;
  const otherPct = ELECTION.otherShare * 100;
  let wVotes = 0;
  let sumExp = 0;
  let sumBreak = 0;
  const assumedLean = ELECTION.states[prior.state]?.earlyLean ?? 0;
  const early = { v: 0, surprise: 0, x: 0, doneV: 0, doneDiff: 0, done: 0 };
  const rows = p.counties.map((c): CountyRow => {
    const { v, f } = countedShare(c);
    const opp = c.count?.opp ?? 0;
    const rep = c.count?.rep ?? 0;
    const other = c.count?.other ?? 0;
    const liveMargin = v > 0 ? ((opp - rep) / v) * 100 : null;
    const expMargin = c.base.margin + forecastSwing;
    const breakMargin = c.base.margin + breakevenSwing;
    // The rest of the county votes at its 2024 margin plus the swing, less the
    // early-vote lean, plus whatever of its own quirk the count has shown.
    const x = 1 - f;
    const shown = v > 0 ? c.tau ** 2 / (c.tau ** 2 + (ELECTION.partialNoise * x) ** 2) : 0;
    const split = splitRemainder(p, c, est.s, est.b);
    const quirk = liveMargin === null || split ? 0 : shown * (liveMargin - c.base.margin - est.s - est.b * x);
    const restMargin = (split ? split.base : c.base.margin) + est.s + quirk - est.b * f;
    const left = Math.max(c.expected - v, 0);
    const done = Boolean(c.count?.complete);
    const projVotes = done ? v : v + left;
    const projMargin = projVotes > 0 ? ((liveMargin ?? 0) * v + (done ? 0 : restMargin * left)) / projVotes : restMargin;
    if (liveMargin !== null) {
      wVotes += v;
      sumExp += (liveMargin - expMargin) * v;
      sumBreak += (liveMargin - breakMargin) * v;
      if (done) {
        early.doneV += v;
        early.doneDiff += (liveMargin - expMargin) * v;
        early.done++;
      } else if (!split) {
        early.v += v;
        early.surprise += (liveMargin - expMargin - assumedLean * x) * v;
        early.x += x * v;
      }
    }
    return {
      name: c.base.name,
      fips: c.base.fips,
      margin2024: c.base.margin,
      votes2024: c.base.votes,
      expectedVotes: Math.round(c.expected),
      expected: { ...shares(expMargin, otherPct), margin: round1(expMargin) },
      breakeven: { ...shares(breakMargin, otherPct), margin: round1(breakMargin) },
      live: {
        opp,
        rep,
        other,
        total: v,
        counted: f,
        complete: done,
        margin: liveMargin === null ? null : round1(liveMargin),
      },
      vsExpected: liveMargin === null ? null : round1(liveMargin - expMargin),
      vsBreakeven: liveMargin === null ? null : round1(liveMargin - breakMargin),
      projected: { margin: round1(projMargin), votes: Math.round(projVotes) },
    };
  });
  const counted = stateCounted(p);
  return {
    state: prior.state,
    margin2024: round1(p.base2024),
    forecastMargin: round1(prior.mean),
    forecastSwing: round1(forecastSwing),
    breakevenSwing: round1(breakevenSwing),
    swing: round1(est.s),
    earlyLean: round1(est.b),
    expectedVotes: Math.round(p.counties.reduce((s, c) => s + c.expected, 0)),
    counted,
    forecastWeight: forecastWeight(counted),
    vsExpected: wVotes > 0 ? round1(sumExp / wVotes) : null,
    vsBreakeven: wVotes > 0 ? round1(sumBreak / wVotes) : null,
    unmatched: p.unmatched,
    earlyCheck: {
      assumedLean,
      learnedLean: round1(est.b),
      partialVsExpected: early.v > 0 ? round1(early.surprise / early.v) : null,
      partialShare: early.v / Math.max(1, p.counties.reduce((s, c) => s + c.expected, 0)),
      asSwing: round1(est.s - forecastSwing),
      asLean: round1(early.v > 0 ? (est.b - assumedLean) * (early.x / early.v) : 0),
      finishedVsForecast: early.doneV > 0 ? round1(early.doneDiff / early.doneV) : null,
      finishedShare: finishedShare(p),
      finishedCount: early.done,
      callNeeds: callNeeds(prior, null),
    },
    rows,
  };
}
