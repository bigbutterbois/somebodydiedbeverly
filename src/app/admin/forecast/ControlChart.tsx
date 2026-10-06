"use client";

import { TrendChart } from "@/app/(site)/forecast/TrendChart";
import type { HistoryPoint } from "@/lib/forecast";
import { OUTCOMES, outcomeOdds } from "./outcomes";

// Chance of each outcome by day.
export function ControlChart({
  senate,
  house,
  electionDay,
}: {
  senate: HistoryPoint[];
  house: HistoryPoint[];
  electionDay: string;
}) {
  const senateByDate = new Map(senate.map((h) => [h.date, h]));
  const points = house.flatMap((h) => {
    const s = senateByDate.get(h.date);
    const odds = s && outcomeOdds(s.p_dem_control, h.p_dem_control, h.p_dem_both ?? null);
    return odds ? [{ date: h.date, values: odds.map((p) => p * 100) }] : [];
  });
  if (points.length === 0) return null;
  return (
    <TrendChart
      label="Chance of each split of Congress by day"
      electionDay={electionDay}
      points={points}
      series={OUTCOMES}
      domain={[0, 100]}
      yTicks={[0, 25, 50, 75, 100]}
      format={(v) => `${Math.round(v)}%`}
    />
  );
}
