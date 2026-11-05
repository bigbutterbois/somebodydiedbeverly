import { ELECTION, pollsCloseAt } from "@/lib/election/config";
import Link from "next/link";
import { getForecast } from "@/lib/forecast";
import { getCountRows, getLaptopCheckins, getLatestSnapshot, getRaceHistory } from "@/lib/election/server";
import { buildSnapshot } from "@/lib/election/live";
import { MAP_HEIGHT, MAP_WIDTH, stateBorders, stateShapes } from "../../(site)/forecast/shapes";
import { AdminOverview } from "./AdminOverview";
import { READERS } from "@/lib/election/sources";
import { Controls } from "./Controls";
import { LiveBlogEditor } from "./LiveBlogEditor";
import { LaptopStatus } from "./LaptopStatus";
import { getElectionPosts } from "@/lib/election/posts";

export const metadata = { title: "Election night" };
// Room for the chart history rebuild, which runs in batches of about 40 seconds.
export const maxDuration = 60;

// When each state's results last moved, so a lagging feed stands out. A state
// is flagged when its polls have closed, it isn't nearly done, and its vote
// count hasn't changed in 20 minutes (or its feed is failing).
const LAG_MINUTES = 20;

// Server-rendered once per request (the page reloads itself every 30 seconds).
const currentTime = () => Date.now();

function ago(iso: string | null, now: number) {
  if (!iso) return "never";
  const min = Math.round((now - Date.parse(iso)) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  return `${Math.floor(min / 60)} h ${min % 60} min ago`;
}

function clock(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
}

export default async function AdminElectionPage() {
  const [rows, snap, forecast, posts, raceHistory, checkins] = await Promise.all([
    getCountRows(),
    getLatestSnapshot(),
    getForecast(),
    getElectionPosts(),
    getRaceHistory().catch(() => []),
    getLaptopCheckins().catch(() => []),
  ]);
  // Before the first refresh there's no snapshot, so show the forecast's odds.
  const board = snap ?? (forecast ? buildSnapshot(forecast, {}) : null);
  const now = currentTime();
  const byState = new Map(rows.map((r) => [r.state, r]));
  const races = new Map((snap?.races ?? []).map((r) => [r.state, r]));
  const states = [...new Set([...Object.keys(READERS), ...rows.map((r) => r.state)])].sort(
    (a, b) => pollsCloseAt(a).getTime() - pollsCloseAt(b).getTime() || a.localeCompare(b),
  );

  return (
    <div className="flex flex-col gap-8">
      <LiveBlogEditor posts={posts} />

      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-normal tracking-tight">Election night</h1>
        <p className="text-sm text-muted">
          Last model run {snap ? `${ago(snap.at, now)} (${clock(snap.at)} ET)` : "never"}. Refreshes every minute from{" "}
          {clock(ELECTION.start)} ET on Nov 3. A state turns red when its polls have closed and its count hasn&apos;t
          moved in {LAG_MINUTES} minutes, or its feed is failing.
        </p>
        <Controls />
      </header>

      <LaptopStatus checkins={checkins} now={now} />

      {board && (
        <AdminOverview
          races={board.races}
          history={raceHistory}
          shapes={stateShapes}
          borders={stateBorders}
          width={MAP_WIDTH}
          height={MAP_HEIGHT}
        />
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-xs uppercase tracking-[0.12em] text-muted">County sheets</h2>
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
          {(forecast?.races ?? [])
            .slice()
            .sort((a, b) => a.state.localeCompare(b.state))
            .map((r) => (
              <Link key={r.state} href={`/admin/election/${r.state}`} className="underline">
                {r.state}
              </Link>
            ))}
        </p>
      </section>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm tabular-nums">
          <thead className="text-xs uppercase tracking-[0.12em] text-muted">
            <tr className="border-b border-line">
              <th className="py-2 pr-4 font-normal">State</th>
              <th className="py-2 pr-4 font-normal">Polls close</th>
              <th className="py-2 pr-4 font-normal">Votes</th>
              <th className="py-2 pr-4 font-normal">Counted</th>
              <th className="py-2 pr-4 font-normal">Count last moved</th>
              <th className="py-2 pr-4 font-normal">Last good read</th>
              <th className="py-2 pr-4 font-normal">Last try</th>
              <th className="py-2 pr-4 font-normal">Problem</th>
            </tr>
          </thead>
          <tbody>
            {states.map((state) => {
              const row = byState.get(state);
              const race = races.get(state);
              const closed = pollsCloseAt(state).getTime() <= now;
              const stale =
                closed &&
                (race?.counted ?? 0) < 0.95 &&
                (!row?.changed_at || now - Date.parse(row.changed_at) > LAG_MINUTES * 60_000);
              const flag = Boolean(row?.error) || (stale && now >= Date.parse(ELECTION.start));
              return (
                <tr key={state} className={`border-b border-line align-top ${flag ? "text-danger" : ""}`}>
                  <td className="py-2 pr-4">
                    {row?.source ? (
                      <a href={row.source} className="underline" target="_blank" rel="noreferrer">
                        {state}
                      </a>
                    ) : (
                      state
                    )}
                    {row?.via === "laptop" && <span className="ml-1 text-xs text-muted">laptop</span>}
                    {!READERS[state] && <span className="ml-1 text-xs text-muted">no reader</span>}
                  </td>
                  <td className="py-2 pr-4">{clock(pollsCloseAt(state).toISOString())}</td>
                  <td className="py-2 pr-4">{row ? row.total_votes.toLocaleString() : "–"}</td>
                  <td className="py-2 pr-4">{race?.status === "live" ? `${Math.round(race.counted * 100)}%` : "–"}</td>
                  <td className="py-2 pr-4">{ago(row?.changed_at ?? null, now)}</td>
                  <td className="py-2 pr-4">{ago(row?.fetched_at ?? null, now)}</td>
                  <td className="py-2 pr-4">{ago(row?.checked_at ?? null, now)}</td>
                  <td className="py-2 pr-4 text-xs">
                    {row?.error}
                    {race?.unmatched && (
                      <span className="block text-muted">Unmatched: {race.unmatched.join(", ")}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {states.length === 0 && <p className="text-sm text-muted">No state feeds are set up yet.</p>}
    </div>
  );
}
