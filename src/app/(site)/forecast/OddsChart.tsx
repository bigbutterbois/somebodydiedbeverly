"use client";

import { APPROVE, DEM, DISAPPROVE, REP, type HistoryPoint } from "@/lib/forecast";
import { TrendChart } from "./TrendChart";

const pct = (v: number) => `${Math.round(v)}%`;

// Chance of control by day.
export function OddsChart({
  history,
  electionDay,
  chamber = "Senate",
}: {
  history: HistoryPoint[];
  electionDay: string;
  chamber?: "Senate" | "House";
}) {
  return (
    <TrendChart
      label={`Chance of ${chamber} control by day`}
      electionDay={electionDay}
      points={history.map((h) => ({
        date: h.date,
        values: [h.p_dem_control * 100, h.p_rep_control * 100],
        note: `${h.dem_seats_mean.toFixed(1)} Dem seats on average`,
      }))}
      series={[
        { label: "Democrats", short: "Dem", color: DEM },
        { label: "Republicans", short: "Rep", color: REP },
      ]}
      domain={[0, 100]}
      yTicks={[0, 25, 50, 75, 100]}
      dashed={50}
      format={pct}
    />
  );
}

// A polling average by day (generic ballot or Trump approval).
export function PollingChart({
  history,
  electionDay,
  kind,
}: {
  history: HistoryPoint[];
  electionDay: string;
  kind: "generic_ballot" | "approval";
}) {
  const ballot = kind === "generic_ballot";
  const points = history.flatMap((h) => {
    if (ballot && h.generic_ballot) return [{ date: h.date, values: [h.generic_ballot.dem, h.generic_ballot.rep] }];
    if (!ballot && h.approval) return [{ date: h.date, values: [h.approval.approve, h.approval.disapprove] }];
    return [];
  });
  if (points.length === 0) return <p className="text-sm text-muted">No polling average yet.</p>;
  const all = points.flatMap((p) => p.values);
  const lo = Math.floor((Math.min(...all) - 3) / 5) * 5;
  const hi = Math.ceil((Math.max(...all) + 3) / 5) * 5;
  const ticks = Array.from({ length: Math.floor((hi - lo) / 5) + 1 }, (_, i) => lo + i * 5);
  return (
    <TrendChart
      label={ballot ? "Generic ballot polling average by day" : "Trump approval polling average by day"}
      electionDay={electionDay}
      points={points}
      series={
        ballot
          ? [
              { label: "Democrats", short: "Dem", color: DEM },
              { label: "Republicans", short: "Rep", color: REP },
            ]
          : [
              { label: "Approve", short: "Approve", color: APPROVE },
              { label: "Disapprove", short: "Disapprove", color: DISAPPROVE },
            ]
      }
      domain={[lo, hi]}
      yTicks={ticks.length > 6 ? ticks.filter((t) => t % 10 === 0) : ticks}
      format={(v) => `${v.toFixed(1).replace(/\.0$/, "")}%`}
    />
  );
}
