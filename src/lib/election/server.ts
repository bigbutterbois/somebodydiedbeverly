import "server-only";
import { getForecast, type Forecast } from "@/lib/forecast";
import { contentClient } from "@/lib/supabase/content";
import { ELECTION } from "./config";
import { buildSnapshot, type LiveSnapshot } from "./live";
import type { CountyCount } from "./model";
import { READERS } from "./sources";
import { DDHQ_URL, ddhqConfigured, readDdhq } from "./sources/ddhq";
import { toCounts } from "./sources/match";
import type { RawCounty } from "./sources/types";

// Election night on the server: fetch each state's feed, keep the counts in
// Supabase, run the model and save a snapshot for the page. Started every
// minute by a Supabase cron job (see the election_night migration), by the
// page itself when the newest snapshot is stale, and by the admin page.

export type CountRow = {
  state: string;
  source: string | null;
  via: "server" | "laptop";
  counties: CountyCount[];
  total_votes: number;
  fetched_at: string | null;
  changed_at: string | null;
  checked_at: string | null;
  error: string | null;
};

export const inWindow = (now = Date.now()) => now >= Date.parse(ELECTION.start) && now <= Date.parse(ELECTION.end);

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

async function fetchText(url: string) {
  const res = await fetch(url, {
    cache: "no-store",
    headers: { "user-agent": BROWSER_UA, accept: "*/*" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`${res.status} from ${new URL(url).host}`);
  return res.text();
}

export async function getCountRows(): Promise<CountRow[]> {
  const supabase = await contentClient();
  const { data } = await supabase.from("election_counts").select("*").order("state");
  return (data ?? []) as CountRow[];
}

export async function getLatestSnapshot(): Promise<LiveSnapshot | null> {
  const supabase = await contentClient();
  const { data } = await supabase
    .from("election_snapshots")
    .select("data")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.data as LiveSnapshot) ?? null;
}

/** The control odds through the night, for the line under the needle. */
export async function getControlHistory(): Promise<{ at: string; p: number }[]> {
  const supabase = await contentClient();
  const { data } = await supabase
    .from("election_snapshots")
    .select("created_at, p:data->control->pDemControl")
    .order("created_at", { ascending: true })
    .limit(3000);
  return (data ?? []).map((d) => ({
    at: d.created_at as string,
    p: Number(d.p),
  }));
}

/** Saves a state's counts (from the server's own read or the laptop), noting whether they moved. */
export async function saveCounts(
  state: string,
  raw: RawCounty[],
  forecast: Forecast,
  via: CountRow["via"],
  source: string,
  previous?: CountRow,
) {
  const race = forecast.races.find((r) => r.state === state);
  if (!race) throw new Error(`no ${state} race`);
  const counties = toCounts(raw, race.rep, race.opp);
  // A county the feed skipped this time (a failed file) keeps its last counts.
  const have = new Set(counties.map((c) => c.name));
  for (const c of previous?.counties ?? []) if (!have.has(c.name)) counties.push(c);
  const total = counties.reduce((s, c) => s + c.rep + c.opp + c.other, 0);
  const now = new Date().toISOString();
  const supabase = await contentClient();
  const { error } = await supabase.from("election_counts").upsert({
    state,
    source,
    via,
    counties,
    total_votes: total,
    fetched_at: now,
    checked_at: now,
    changed_at: previous && previous.total_votes === total ? previous.changed_at : now,
    error: null,
  });
  if (error) throw new Error(error.message);
  // Keep a copy each time the total moves, for the admin's "last 15 minutes"
  // column, and drop copies over two hours old. Best effort: the live page
  // doesn't depend on it.
  if (!previous || previous.total_votes !== total) {
    await supabase.from("election_count_history").insert({ state, at: now, counties, total_votes: total });
    await supabase
      .from("election_count_history")
      .delete()
      .eq("state", state)
      .lt("at", new Date(Date.now() - 2 * 3600_000).toISOString());
  }
  return total;
}

/**
 * Votes each county added in the last `minutes`, by county name, plus the
 * statewide total. Compares the current counts with the newest copy from
 * before the window; a state that hasn't moved in the window added nothing,
 * and one that started reporting inside it added everything it has.
 */
export async function getRecentGains(state: string, current: CountRow | undefined, minutes = 15) {
  const gains = new Map<string, number>();
  if (!current?.counties.length) return { gains, total: 0 };
  const since = new Date(Date.now() - minutes * 60_000).toISOString();
  if (current.changed_at && current.changed_at < since) return { gains, total: 0 };
  const supabase = await contentClient();
  const { data } = await supabase
    .from("election_count_history")
    .select("counties")
    .eq("state", state)
    .lte("at", since)
    .order("at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const before = new Map(((data?.counties ?? []) as CountyCount[]).map((c) => [c.name, c.rep + c.opp + c.other]));
  let total = 0;
  for (const c of current.counties) {
    const added = c.rep + c.opp + c.other - (before.get(c.name) ?? 0);
    if (added) gains.set(c.name, added);
    total += added;
  }
  return { gains, total };
}

/** Each race's opposition odds after every refresh, for the admin's small charts. */
export async function getRaceHistory(): Promise<{ at: string; odds: Record<string, number> }[]> {
  const supabase = await contentClient();
  const { data } = await supabase
    .from("election_snapshots")
    .select("created_at, odds:data->odds")
    .order("created_at", { ascending: true })
    .limit(3000);
  return (data ?? [])
    .filter((d) => d.odds)
    .map((d) => ({ at: d.created_at as string, odds: d.odds as Record<string, number> }));
}

async function saveError(state: string, message: string, source: string) {
  const supabase = await contentClient();
  const now = new Date().toISOString();
  const { data } = await supabase.from("election_counts").select("state").eq("state", state).maybeSingle();
  if (data) await supabase.from("election_counts").update({ checked_at: now, error: message }).eq("state", state);
  else await supabase.from("election_counts").insert({ state, source, checked_at: now, error: message });
}

/** Runs the model on the stored counts and saves a snapshot. */
export async function snapshot(forecast?: Forecast) {
  const f = forecast ?? (await getForecast(true));
  if (!f) throw new Error("No forecast to start from.");
  const rows = await getCountRows();
  const counts: Record<string, CountyCount[] | undefined> = {};
  for (const state of Object.keys(READERS)) counts[state] = [];
  for (const row of rows) if (row.fetched_at) counts[row.state] = row.counties;
  const snap = buildSnapshot(f, counts);
  const supabase = await contentClient();
  // A compact copy of every race's odds rides along for the admin's charts.
  const odds = Object.fromEntries(snap.races.map((r) => [r.state, Math.round(r.pOpp * 1000) / 1000]));
  const { error } = await supabase.from("election_snapshots").insert({ data: { ...snap, odds } });
  if (error) throw new Error(error.message);
  await postCalls(snap);
  return snap;
}

/**
 * Posts "RACE CALLED: …" to the live blog as WMHQ Bot the first time each race
 * is called. The unique call_key makes repeats a no-op, so it's safe to run on
 * every refresh. Never fails the refresh.
 */
async function postCalls(snap: LiveSnapshot) {
  const rows = snap.races
    .filter((r) => r.called)
    .map((r) => {
      const winner = r.called === "opp" ? r.opp : r.rep;
      return {
        body: `RACE CALLED: ${winner.name} (${winner.party}) wins in ${r.name}`,
        author: "WMHQ Bot",
        call_key: `${r.state}:${r.called}`,
      };
    });
  if (!rows.length) return;
  try {
    const supabase = await contentClient();
    await supabase.from("election_posts").upsert(rows, { onConflict: "call_key", ignoreDuplicates: true });
  } catch {
    // The blog is a nice-to-have; the snapshot is already saved.
  }
}

/**
 * Reads every state feed, saves the counts and a new snapshot. Skips when
 * another refresh started under a minute ago (or, unless forced, outside
 * election night).
 */
export async function refresh({ force = false } = {}) {
  if (!force && !inWindow()) return { ran: false, reason: "not election night" };
  const supabase = await contentClient();
  const { data: claimed } = await supabase.rpc("election_claim_refresh", {
    min_seconds: force ? 15 : ELECTION.refreshSeconds,
  });
  if (!claimed) return { ran: false, reason: "refreshed moments ago" };

  const forecast = await getForecast(true);
  if (!forecast) return { ran: false, reason: "no forecast" };
  const rows = new Map((await getCountRows()).map((r) => [r.state, r]));

  // Decision Desk HQ first, when set up: one call covers every race it has.
  const covered = new Set<string>();
  const ddhq: Record<string, unknown> = {};
  if (ddhqConfigured()) {
    const now = new Date().toISOString();
    try {
      const states = await readDdhq();
      for (const s of states) {
        if (!forecast.races.some((r) => r.state === s.state) || !s.counties.length) continue;
        try {
          ddhq[s.state] = await saveCounts(s.state, s.counties, forecast, "server", DDHQ_URL, rows.get(s.state));
          covered.add(s.state);
        } catch (e) {
          ddhq[s.state] = e instanceof Error ? e.message : String(e);
        }
      }
      await supabase.from("election_counts").upsert({
        state: "DDHQ",
        source: DDHQ_URL,
        fetched_at: now,
        checked_at: now,
        changed_at: now,
        error: null,
        total_votes: states.length,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      ddhq.error = message;
      await supabase.from("election_counts").upsert({
        state: "DDHQ",
        source: DDHQ_URL,
        checked_at: now,
        error: message.slice(0, 300),
      });
    }
  }

  const results = await Promise.all(
    Object.entries(READERS)
      .filter(([state]) => !covered.has(state))
      .map(async ([state, reader]) => {
        const previous = rows.get(state);
        // The laptop is feeding this state (the site can't reach it): leave it be.
        if (
          previous?.via === "laptop" &&
          previous.fetched_at &&
          Date.now() - Date.parse(previous.fetched_at) < 5 * 60_000
        ) {
          return { state, skipped: "laptop" };
        }
        try {
          const raw = await reader!.read(fetchText);
          const votes = await saveCounts(state, raw, forecast, "server", reader!.url, previous);
          return { state, votes };
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          await saveError(state, message.slice(0, 300), reader!.url);
          return { state, error: message };
        }
      }),
  );
  const snap = await snapshot(forecast);
  return { ran: true, at: snap.at, ddhq, results };
}

export type LaptopState = {
  state: string;
  /** County rows sent (one "Statewide" row where NYT has no county breakdown). */
  units: number;
  /** Of those, how many have any votes. */
  reporting: number;
  votes: number;
  statewide: boolean;
  /** The saved total, or the error saving it. */
  saved: number | string;
};
export type LaptopCheckin = {
  at: string;
  states: LaptopState[];
  failed: { state: string; error: string }[];
  waiting: string[];
};

/** Notes a laptop check-in for the admin page. Best effort: never fails the post. */
export async function saveLaptopCheckin(
  states: LaptopState[],
  failed: LaptopCheckin["failed"],
  waiting: string[],
) {
  try {
    const supabase = await contentClient();
    await supabase.from("election_laptop_checkins").insert({ states, failed, waiting });
    await supabase
      .from("election_laptop_checkins")
      .delete()
      .lt("at", new Date(Date.now() - 2 * 3600_000).toISOString());
  } catch {}
}

/** The laptop's check-ins in the last `minutes`, newest first (empty before the table exists). */
export async function getLaptopCheckins(minutes = 120): Promise<LaptopCheckin[]> {
  const supabase = await contentClient();
  const { data, error } = await supabase
    .from("election_laptop_checkins")
    .select("at, states, failed, waiting")
    .gte("at", new Date(Date.now() - minutes * 60_000).toISOString())
    .order("at", { ascending: false })
    .limit(200);
  if (error) return [];
  return (data ?? []) as LaptopCheckin[];
}
