import "server-only";
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { LINE_BY_CODE, LINES, STATION_BY_CODE, STATION_BY_KEY, type LineCode } from "./network";

// WMATA's API, called only from the server so the key (WMATA_API_KEY, a Vercel
// environment variable) never reaches the browser.
//
// The free tier allows 10 calls a second and 50,000 a day, so every call is
// both cached and budgeted:
// - Each feed is cached for a set time (trains 10 seconds, a station's arrivals
//   15, alerts 60, stations and track layout a day). However many people have
//   the page open, WMATA sees at most one call per feed per window, and only
//   while someone is looking.
// - Before any real call the server takes a ticket from the database
//   (wmata_take, in supabase/migrations/…_wmata_budget.sql), which caps the
//   whole site at 8 calls a second and 45,000 a day across every server
//   instance. Without a ticket the call is skipped and the page keeps showing
//   what it last had.

const BASE = "https://api.wmata.com";

export class NoKeyError extends Error {
  constructor() {
    super("WMATA_API_KEY is not set");
  }
}

export class BudgetError extends Error {
  constructor() {
    super("WMATA call budget used up for now");
  }
}

/** What an API route answers when WMATA can't be reached: 503 before the key is set up, 429 over budget, else 502. */
export function errorResponse(error: unknown) {
  if (error instanceof NoKeyError) return Response.json({ error: "no-key" }, { status: 503 });
  if (error instanceof BudgetError) return Response.json({ error: "budget" }, { status: 429 });
  console.error(error);
  // The message names the step that failed (never the key), so /api/metro/trains shows what's wrong.
  return Response.json({ error: "wmata", detail: error instanceof Error ? error.message : String(error) }, { status: 502 });
}

/** One ticket from the site-wide budget. Fails closed: no database answer, no call. */
async function takeTicket() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("Call budget check failed: SUPABASE_SECRET_KEY is not set");
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc("wmata_take");
  if (error) throw new Error(`Call budget check failed: ${error.message}`);
  if (data !== true) throw new BudgetError();
}

async function call<T>(path: string): Promise<T> {
  const key = process.env.WMATA_API_KEY;
  if (!key) throw new NoKeyError();
  await takeTicket();
  const res = await fetch(`${BASE}${path}`, { headers: { api_key: key }, cache: "no-store" });
  if (!res.ok) throw new Error(`WMATA ${path}: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

/** A WMATA call cached for `seconds`, shared by every visitor and server instance. */
function cached<A extends string[], T>(name: string, seconds: number, fn: (...args: A) => Promise<T>) {
  return unstable_cache(fn, ["wmata", name], { revalidate: seconds });
}

// ---------------------------------------------------------------------------
// Stations

type WmataStation = { Code: string; Lat: number; Lon: number };

/** [longitude, latitude] for every station key. Changes only when stations open. */
export const getStationCoords = cached("stations", 86400, async () => {
  const { Stations } = await call<{ Stations: WmataStation[] }>("/Rail.svc/json/jStations");
  const coords: Record<string, [number, number]> = {};
  for (const st of Stations) {
    const station = STATION_BY_CODE.get(st.Code);
    if (station && !coords[station.key]) coords[station.key] = [st.Lon, st.Lat];
  }
  return coords;
});

// ---------------------------------------------------------------------------
// Arrivals

type WmataPrediction = {
  Car: string | null;
  DestinationName: string | null;
  DestinationCode: string | null;
  Group: string;
  Line: string;
  Min: string;
};

export type Arrival = {
  line: LineCode | null;
  destination: string;
  /** Minutes away as WMATA shows it: a number, "ARR" (arriving) or "BRD" (boarding). */
  min: string;
  cars: number | null;
  /** WMATA's platform group, "1" or "2": one per direction of travel. */
  group: string;
};

const minOrder = (min: string) => (min === "BRD" ? -2 : min === "ARR" ? -1 : Number.parseInt(min, 10) || 999);

const getPredictions = cached("predictions", 15, async (codes: string) => {
  const { Trains } = await call<{ Trains: WmataPrediction[] }>(`/StationPrediction.svc/json/GetPrediction/${codes}`);
  return Trains;
});

/** The next trains at a station, every level of it, soonest first. */
export async function getArrivals(stationKey: string): Promise<Arrival[]> {
  const station = STATION_BY_KEY.get(stationKey);
  if (!station) return [];
  const Trains = await getPredictions(station.codes.join(","));
  return Trains.filter((t) => t.Min && t.Min !== "---" && t.DestinationName && t.DestinationName !== "No Passenger")
    .map((t) => ({
      line: LINE_BY_CODE.has(t.Line as LineCode) ? (t.Line as LineCode) : null,
      destination: STATION_BY_CODE.get(t.DestinationCode ?? "")?.name ?? t.DestinationName ?? "",
      min: t.Min,
      cars: Number.parseInt(t.Car ?? "", 10) || null,
      group: t.Group,
    }))
    .sort((a, b) => minOrder(a.min) - minOrder(b.min));
}

// ---------------------------------------------------------------------------
// Alerts

type WmataIncident = { Description: string; LinesAffected: string; DateUpdated: string };

export type Alert = { lines: LineCode[]; text: string; updated: string };

/** WMATA's current rail alerts (delays, single tracking, closures). */
export const getAlerts = cached("alerts", 60, async (): Promise<Alert[]> => {
  const { Incidents } = await call<{ Incidents: WmataIncident[] }>("/Incidents.svc/json/Incidents");
  return Incidents.map((i) => ({
    lines: i.LinesAffected.split(/[;,\s]+/).filter((c): c is LineCode => LINE_BY_CODE.has(c as LineCode)),
    text: i.Description,
    updated: i.DateUpdated,
  }));
});

// ---------------------------------------------------------------------------
// Train positions
//
// WMATA reports each train by the track circuit it's on (a stretch of track a
// few hundred feet long). Its "standard routes" list every circuit along each
// line in order, with the station circuits marked, so a train's spot becomes
// "this far between station A and station B". That works the same on the
// to-scale map and the diagram.

type WmataTrain = {
  TrainId: string;
  TrainNumber: string;
  DirectionNum: number;
  SecondsAtLocation: number;
  CarCount: number;
  CircuitId: number;
  DestinationStationCode: string | null;
  LineCode: string | null;
  ServiceType: string;
};

type WmataRoute = {
  LineCode: string;
  TrackNum: number;
  TrackCircuits: { SeqNum: number; CircuitId: number; StationCode: string | null }[];
};

export type Train = {
  id: string;
  /** The number WMATA shows for the train (not unique over a day, unlike id). */
  number: string;
  /** False for trains running without passengers (moving between yards and lines, testing). */
  passengers: boolean;
  line: LineCode;
  cars: number;
  destination: string | null;
  /** Station key of the destination, which says which way the train is heading. */
  toward: string | null;
  /** WMATA's track number, 1 or 2. */
  track: number;
  /** Heading toward the end of the line's station list (from → to) rather than its start. */
  forward: boolean;
  /** Seconds since the train last moved onto a new stretch of track (stopped, if large). */
  still: number;
  /** Station keys the train is between, in the line's order, and how far along it is (0 to 1). */
  from: string;
  to: string;
  t: number;
};

type Placement = { from: string; to: string; t: number };

/**
 * Each line and track's circuits in order, kept small for the cache: the
 * circuit ids, and which positions in that list are stations.
 */
const getRoutes = cached("routes", 86400, async () => {
  const { StandardRoutes } = await call<{ StandardRoutes: WmataRoute[] }>(
    "/TrainPositions/StandardRoutes?contentType=json",
  );
  return StandardRoutes.map((route) => {
    const circuits = [...route.TrackCircuits].sort((a, b) => a.SeqNum - b.SeqNum);
    return {
      id: `${route.LineCode}-${route.TrackNum}`,
      line: route.LineCode,
      circuits: circuits.map((c) => c.CircuitId),
      stops: circuits.flatMap((c, i) => {
        const key = c.StationCode ? STATION_BY_CODE.get(c.StationCode)?.key : undefined;
        return key ? [[i, key] as const] : [];
      }),
    };
  });
});

const getPositions = cached("positions", 10, async () => {
  const { TrainPositions } = await call<{ TrainPositions: WmataTrain[] }>(
    "/TrainPositions/TrainPositions?contentType=json",
  );
  return TrainPositions;
});

/** For each line and track: circuit id → where that circuit sits between stations. */
function placements(routes: Awaited<ReturnType<typeof getRoutes>>) {
  const map = new Map<string, Map<number, Placement>>();
  for (const route of routes) {
    const line = LINES.find((l) => l.code === route.line);
    if (!line || route.stops.length === 0) continue;
    const byCircuit = new Map<number, Placement>();
    let s = 0; // index into stops of the next station at or after circuit i
    for (let i = 0; i < route.circuits.length; i++) {
      while (s < route.stops.length && route.stops[s][0] < i) s++;
      const prev = route.stops[route.stops[s]?.[0] === i ? s : s - 1];
      const next = route.stops[s];
      const a = (prev ?? next)[1];
      const b = (next ?? prev)[1];
      const t = prev && next && next[0] > prev[0] ? (i - prev[0]) / (next[0] - prev[0]) : 0;
      // Keep from/to in the line's own station order, so the map can tell which side is which track.
      const forward = line.stations.indexOf(a) <= line.stations.indexOf(b);
      byCircuit.set(route.circuits[i], forward ? { from: a, to: b, t } : { from: b, to: a, t: 1 - t });
    }
    map.set(route.id, byCircuit);
  }
  return map;
}

/**
 * Every train on the main line and where it is: passenger trains, and trains
 * running empty (which often carry no line, so they take the line whose track
 * they're on). Trains in yards and on side tracks aren't on any line's route
 * and are left out.
 */
export async function getTrains(): Promise<Train[]> {
  const [positions, routes] = await Promise.all([getPositions(), getRoutes()]);
  const circuits = placements(routes);
  const lineCodes = LINES.map((l) => l.code);
  const found: (Omit<Train, "forward"> & { dir: number })[] = [];
  for (const t of positions) {
    const passengers = t.ServiceType === "Normal";
    const own = LINE_BY_CODE.has(t.LineCode as LineCode) ? (t.LineCode as LineCode) : null;
    if (passengers && !own) continue;
    search: for (const line of own ? [own] : lineCodes) {
      for (const track of [1, 2]) {
        const place = circuits.get(`${line}-${track}`)?.get(t.CircuitId);
        if (!place) continue;
        const dest = passengers ? STATION_BY_CODE.get(t.DestinationStationCode ?? "") : undefined;
        found.push({
          id: t.TrainId || t.TrainNumber,
          number: t.TrainNumber,
          passengers,
          line,
          cars: t.CarCount,
          destination: dest?.name ?? null,
          toward: dest?.key ?? null,
          track,
          still: t.SecondsAtLocation,
          dir: t.DirectionNum,
          ...place,
        });
        break search;
      }
    }
  }

  // Which way a train heads: toward its destination when it has one. Otherwise by WMATA's
  // direction number, read the way the line's passenger trains read it right now.
  const vote = new Map<string, number>();
  const towardEnd = (t: (typeof found)[number]) => {
    const stops = LINE_BY_CODE.get(t.line)!.stations;
    const here = stops.indexOf(t.from);
    const dest = t.toward ? stops.indexOf(t.toward) : -1;
    return dest >= 0 && dest !== here ? dest > here : null;
  };
  for (const t of found) {
    const f = towardEnd(t);
    if (f !== null) vote.set(`${t.line}-${t.dir}`, (vote.get(`${t.line}-${t.dir}`) ?? 0) + (f ? 1 : -1));
  }
  return found.map(({ dir, ...t }) => {
    const known = towardEnd({ ...t, dir });
    const guess = vote.get(`${t.line}-${dir}`) ?? -(vote.get(`${t.line}-${3 - dir}`) ?? 0);
    return { ...t, forward: known ?? (guess !== 0 ? guess > 0 : dir === 1) };
  });
}
