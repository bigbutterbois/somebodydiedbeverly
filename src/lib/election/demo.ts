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

/** Made-up live blog posts for the ?demo preview. */
export function demoPosts() {
  const at = (min: number) => new Date(Date.parse("2026-11-04T03:00:00Z") - min * 60_000).toISOString();
  return [
    { id: -4, body: "RACE CALLED: Ashley Moody (R) wins in Florida", created_at: at(-2), author: "WMHQ Bot" },
    {
      id: -1,
      body: "North Carolina's early vote is in and Cooper is running about two points ahead of where he needs to be in Wake and Mecklenburg. The rural east hasn't reported much yet, so expect this to tighten.",
      created_at: at(0),
    },
    {
      id: -2,
      body: "Georgia's first batch is mostly mail ballots from metro Atlanta. Ossoff's big lead here is expected; the needle is barely moving because the model already knew these would lean his way.",
      created_at: at(14),
    },
    {
      id: -3,
      body: "Polls are closed in Georgia, Virginia and South Carolina. First results should start coming in within the next half hour.",
      created_at: at(31),
    },
  ];
}
