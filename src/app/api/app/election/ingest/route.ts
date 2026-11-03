import { getForecast } from "@/lib/forecast";
import { getCountRows, saveCounts, saveLaptopCheckin, snapshot } from "@/lib/election/server";
import type { RawCounty } from "@/lib/election/sources/types";

// The laptop backup (scripts/nyt_laptop.py, scripts/election-laptop.ts) posts
// here every minute: each state's counts when the site can't read that state's
// feed itself, plus the states it couldn't read or that have no votes yet. A
// post with no states is just a check-in, so Admin -> Election can tell the
// script is still running. Owner only: it signs in like the iPhone app and
// sends a bearer token (src/proxy.ts checks it).
export const maxDuration = 60;

type Body = {
  states?: { state: string; source: string; counties: RawCounty[] }[];
  failed?: { state: string; error: string }[];
  waiting?: string[];
  snapshot?: boolean;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body || (!body.states && !body.failed && !body.waiting)) {
    return Response.json({ error: "states" }, { status: 400 });
  }
  const states = body.states ?? [];
  const saved: Record<string, number | string> = {};
  if (states.length) {
    const forecast = await getForecast(true);
    if (!forecast) return Response.json({ error: "no forecast" }, { status: 500 });
    const rows = new Map((await getCountRows()).map((r) => [r.state, r]));
    for (const s of states) {
      try {
        saved[s.state] = await saveCounts(s.state, s.counties, forecast, "laptop", s.source, rows.get(s.state));
      } catch (e) {
        saved[s.state] = e instanceof Error ? e.message : String(e);
      }
    }
    if (body.snapshot !== false) await snapshot(forecast);
  }
  await saveLaptopCheckin(
    states.map((s) => ({
      state: s.state,
      units: s.counties.length,
      reporting: s.counties.filter((c) => c.candidates.some((x) => x.votes > 0)).length,
      votes: s.counties.reduce((t, c) => t + c.candidates.reduce((u, x) => u + (x.votes || 0), 0), 0),
      statewide: s.counties.length === 1 && s.counties[0].name === "Statewide",
      saved: saved[s.state],
    })),
    body.failed ?? [],
    body.waiting ?? [],
  );
  return Response.json({ saved });
}
