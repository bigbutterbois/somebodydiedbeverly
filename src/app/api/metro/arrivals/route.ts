import { type NextRequest } from "next/server";
import { STATION_BY_KEY, linesAt } from "@/lib/metro/network";
import { errorResponse, getAlerts, getArrivals } from "@/lib/metro/wmata";

// The next trains at one station (?station=A01), plus WMATA alerts for its lines.
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("station") ?? "";
  if (!STATION_BY_KEY.has(key)) return Response.json({ error: "station" }, { status: 400 });
  try {
    const lines = new Set(linesAt(key).map((l) => l.code));
    const [arrivals, alerts] = await Promise.all([getArrivals(key), getAlerts().catch(() => [])]);
    return Response.json({
      updated: new Date().toISOString(),
      arrivals,
      alerts: alerts.filter((a) => a.lines.some((l) => lines.has(l))),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
