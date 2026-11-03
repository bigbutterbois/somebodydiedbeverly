import type { NextRequest } from "next/server";
import { getForecast } from "@/lib/forecast";
import { demoCounts } from "@/lib/election/demo";
import { buildSnapshot, projectedShares, SHARE_CHART } from "@/lib/election/live";
import { getShareHistory } from "@/lib/election/server";

// One race's projected vote shares through the night, for the chart that
// opens when a state on the /election map is clicked. ?demo=40 makes up a
// night that reaches about 40% counted, to match the page's demo.
export async function GET(req: NextRequest) {
  const state = (req.nextUrl.searchParams.get("state") ?? "").toUpperCase();
  const demo = Math.min(Number(req.nextUrl.searchParams.get("demo")) || 0, 100);
  if (!/^[A-Z]{2}$/.test(state)) return Response.json([], { status: 400 });
  if (!demo) {
    return Response.json(await getShareHistory(state), { headers: { "Cache-Control": "no-store" } });
  }
  const forecast = await getForecast();
  if (!forecast) return Response.json([]);
  // The demo page sits at 10pm Eastern; step up to it from 6:30pm.
  const from = Date.parse(SHARE_CHART.from);
  const until = Date.parse("2026-11-04T03:00:00Z");
  const steps = 16;
  const out: { at: string; s: number[] }[] = [];
  for (let i = 0; i <= steps; i++) {
    const at = new Date(from + ((until - from) * i) / steps);
    const snap = buildSnapshot(forecast, demoCounts(forecast, (demo * i) / steps), at);
    const race = snap.races.find((r) => r.state === state);
    if (race) out.push({ at: at.toISOString(), s: projectedShares(race) });
  }
  return Response.json(out);
}
