// Made-up election night counts, for previewing the page before Nov 3
// (/election?demo=40 shows every race about 40% counted). Each county votes
// like 2024 shifted by its race's forecast swing plus some noise, reports a
// random share, and its early votes lean a few points Democratic.
import baselines from "./baselines.json";
import type { Forecast } from "@/lib/forecast";
import type { CountyCount } from "./model";

type County = { fips: string; name: string; margin: number; votes: number };

export function demoCounts(forecast: Forecast, percent: number): Record<string, CountyCount[]> {
  let seed = 11;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const out: Record<string, CountyCount[]> = {};
  for (const race of forecast.races) {
    const counties = (baselines as Record<string, County[]>)[race.state] ?? [];
    const total = counties.reduce((s, c) => s + c.votes, 0);
    const base = counties.reduce((s, c) => s + c.margin * c.votes, 0) / Math.max(total, 1);
    const swing = race.mean_margin - base + (rand() - 0.5) * 6;
    out[race.state] = counties.map((c) => {
      const f = Math.max(0, Math.min(1, (percent / 100) * (0.4 + rand() * 1.2)));
      const v = c.votes * 0.72 * f;
      const m = c.margin + swing + (rand() - 0.5) * 6 + 5 * (1 - f);
      const other = v * 0.02;
      return {
        name: c.name,
        fips: c.fips,
        opp: (v - other) * Math.min(1, Math.max(0, 0.5 + m / 200)),
        rep: (v - other) * Math.min(1, Math.max(0, 0.5 - m / 200)),
        other,
        complete: f >= 1,
      };
    });
  }
  return out;
}
