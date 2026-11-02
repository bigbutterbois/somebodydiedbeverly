import { getForecast } from "@/lib/forecast";
import { getCountRows, saveCounts, snapshot } from "@/lib/election/server";
import type { RawCounty } from "@/lib/election/sources/types";

// The laptop backup (scripts/election-laptop.ts) posts a state's counts here
// when the site can't read that state's feed itself. Owner only: it signs in
// like the iPhone app and sends a bearer token (src/proxy.ts checks it).
export const maxDuration = 60;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { states?: { state: string; source: string; counties: RawCounty[] }[]; snapshot?: boolean }
    | null;
  if (!body?.states?.length) return Response.json({ error: "states" }, { status: 400 });
  const forecast = await getForecast(true);
  if (!forecast) return Response.json({ error: "no forecast" }, { status: 500 });
  const rows = new Map((await getCountRows()).map((r) => [r.state, r]));
  const saved: Record<string, number | string> = {};
  for (const s of body.states) {
    try {
      saved[s.state] = await saveCounts(s.state, s.counties, forecast, "laptop", s.source, rows.get(s.state));
    } catch (e) {
      saved[s.state] = e instanceof Error ? e.message : String(e);
    }
  }
  if (body.snapshot !== false) await snapshot(forecast);
  return Response.json({ saved });
}
