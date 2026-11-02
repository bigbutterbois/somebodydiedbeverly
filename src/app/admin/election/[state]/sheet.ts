import "server-only";
import { getForecast } from "@/lib/forecast";
import { priorsFrom } from "@/lib/election/live";
import { countySheet } from "@/lib/election/model";
import { getCountRows } from "@/lib/election/server";

/** The county sheet for one state, from the final forecast and the latest stored counts. */
export async function loadSheet(state: string) {
  const forecast = await getForecast();
  const race = forecast?.races.find((r) => r.state === state);
  if (!forecast || !race) return null;
  const prior = priorsFrom(forecast).find((p) => p.state === state)!;
  const rows = await getCountRows().catch(() => []);
  const counts = rows.find((r) => r.state === state && r.fetched_at)?.counties ?? null;
  return { race, sheet: countySheet(prior, counts), forecastAt: forecast.generated_at, final: Boolean(forecast.final) };
}

/** "D+3.2" / "R+1.0" / "Even", with the opposition's party letter. */
export function marginText(m: number | null, opp: string) {
  if (m === null) return "–";
  if (Math.abs(m) < 0.05) return "Even";
  return m > 0 ? `${opp}+${m.toFixed(1)}` : `R+${(-m).toFixed(1)}`;
}

/** "+2.1" toward the opposition, "−2.1" toward the Republican. */
export function diffText(d: number | null) {
  if (d === null) return "–";
  return `${d > 0 ? "+" : d < 0 ? "−" : ""}${Math.abs(d).toFixed(1)}`;
}
