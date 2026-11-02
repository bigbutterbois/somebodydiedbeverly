// Builds the election night snapshot (what the page shows) from the final
// forecast and the latest county counts. Pure, so the replay test and the
// server share it.

import type { Forecast } from "@/lib/forecast";
import { ELECTION, pollsCloseAt } from "./config";
import { inverseNormal, runModel, senateControl, type CountyCount, type Prior, type RaceResult } from "./model";

export type LiveRace = RaceResult & {
  name: string;
  special: boolean;
  rep: { name: string; party: string };
  opp: { name: string; party: string };
  /** The opposition candidate counts toward Democratic control. */
  oppCaucusD: boolean;
  pollsClose: string;
  forecast: { pOpp: number; mean: number };
  rankedChoice?: boolean;
};

export type LiveSnapshot = {
  at: string;
  forecastAt: string;
  forecastFinal: boolean;
  /** How far states with results run from their forecasts, in standard deviations (+ = opposition). */
  signal: number;
  control: { pDemControl: number; demSeatsMean: number; forecastPDem: number; distribution: Record<number, number> };
  races: LiveRace[];
};

/** Each race's starting point: the forecast's mean margin, with a spread that reproduces its odds. */
export function priorsFrom(forecast: Forecast): Prior[] {
  return forecast.races.map((r) => {
    const width = Math.max((r.margin_90 - r.margin_10) / 2.563, 1);
    const z = inverseNormal(Math.min(Math.max(r.p_opp, 0.001), 0.999));
    // Use the spread implied by the odds when it's well defined, kept near the 10-90 range.
    const implied = Math.abs(z) > 0.25 ? r.mean_margin / z : width;
    const sd = Math.min(Math.max(implied, width * 0.6), width * 1.6);
    return { state: r.state, name: r.name, mean: r.mean_margin, sd, pOpp: r.p_opp };
  });
}

export function buildSnapshot(
  forecast: Forecast,
  counts: Record<string, CountyCount[] | undefined>,
  now = new Date(),
): LiveSnapshot {
  const closed = new Set(forecast.races.map((r) => r.state).filter((s) => pollsCloseAt(s) <= now));
  const { races, signal } = runModel({ priors: priorsFrom(forecast), counts, closed });
  const byState = new Map(forecast.races.map((r) => [r.state, r]));
  const caucusD = Object.fromEntries(forecast.races.map((r) => [r.state, r.opp.caucus !== "none"]));
  const seatsNotUp = forecast.dem_seats_not_up ?? 34;
  const majority = forecast.majority ?? 51;
  const live = senateControl(races, caucusD, seatsNotUp, majority);
  // The quick control simulation here ties races together more loosely than the
  // forecast model does, so it would start a few points off the forecast's own
  // control odds. Run it on the forecast's race odds too and carry over only the
  // change (on the log-odds scale), so the needle starts exactly at the forecast.
  const start = senateControl(
    races.map((r) => ({ ...r, pOpp: byState.get(r.state)!.p_opp, called: null })),
    caucusD,
    seatsNotUp,
    majority,
  );
  const logit = (p: number) => Math.log(Math.min(Math.max(p, 1e-4), 1 - 1e-4) / (1 - Math.min(Math.max(p, 1e-4), 1 - 1e-4)));
  const shifted = 1 / (1 + Math.exp(-(logit(forecast.p_dem_control) + logit(live.pDemControl) - logit(start.pDemControl))));
  const control = {
    ...live,
    pDemControl: live.pDemControl >= 1 || live.pDemControl <= 0 ? live.pDemControl : shifted,
    demSeatsMean: Math.round((live.demSeatsMean - start.demSeatsMean + forecast.dem_seats_mean) * 10) / 10,
  };
  return {
    at: now.toISOString(),
    forecastAt: forecast.generated_at,
    forecastFinal: Boolean(forecast.final),
    signal,
    control: { ...control, forecastPDem: forecast.p_dem_control },
    races: races.map((race) => {
      const f = byState.get(race.state)!;
      return {
        ...race,
        name: f.name,
        special: f.special,
        rep: { name: f.rep.name, party: f.rep.party },
        opp: { name: f.opp.name, party: f.opp.party },
        oppCaucusD: caucusD[race.state],
        pollsClose: pollsCloseAt(race.state).toISOString(),
        forecast: { pOpp: f.p_opp, mean: f.mean_margin },
        rankedChoice: ELECTION.states[race.state]?.rankedChoice || undefined,
      };
    }),
  };
}
