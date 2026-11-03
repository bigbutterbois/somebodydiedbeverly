import baselines from "@/lib/election/baselines.json";
import type { LaptopCheckin } from "@/lib/election/server";

// Is the laptop script (scripts/nyt_laptop.py) alive and sending every county?
// It checks in every 60 seconds, so a gap over 90 seconds is worth a look and
// over 3 minutes means it has stopped. Below that, what it sent per state in
// its latest check-in, against the number of counties in the 2024 baseline.

const COUNTIES = Object.fromEntries(Object.entries(baselines as Record<string, unknown[]>).map(([s, c]) => [s, c.length]));

function since(iso: string, now: number) {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 90) return `${s} s ago`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ${m % 60} min ago`;
}

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "America/New_York",
  });

export function LaptopStatus({ checkins, now }: { checkins: LaptopCheckin[]; now: number }) {
  const last = checkins[0];
  const gap = last ? (now - Date.parse(last.at)) / 1000 : Infinity;
  const tone = gap <= 90 ? "ok" : gap <= 180 ? "late" : "down";
  const dot = { ok: "bg-accent", late: "bg-muted", down: "bg-danger" }[tone];
  const recent = checkins.filter((c) => now - Date.parse(c.at) <= 10 * 60_000).length;
  // Votes per state in the check-in before the latest, to show what moved.
  const before = new Map<string, number>();
  for (const s of checkins[1]?.states ?? []) before.set(s.state, s.votes);
  const states = (last?.states ?? []).slice().sort((a, b) => a.state.localeCompare(b.state));

  return (
    <section className="flex flex-col gap-3 rounded border border-line p-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-muted">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${dot}`} aria-hidden />
          Laptop script
        </h2>
        <p className={`text-sm ${tone === "down" ? "text-danger" : ""}`}>
          {last
            ? `Last check-in ${since(last.at, now)} (${clock(last.at)} ET)${tone === "down" ? ". It looks stopped." : ""}`
            : "No check-ins in the last 2 hours. It isn't running, or it's an older copy of nyt_laptop.py."}
        </p>
        {last && (
          <p className={`text-sm ${recent < 8 ? "text-danger" : "text-muted"}`}>
            {recent} check-ins in the last 10 min (expect 10)
          </p>
        )}
      </div>

      {last && (
        <>
          {states.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm tabular-nums">
                <thead className="text-xs uppercase tracking-[0.12em] text-muted">
                  <tr className="border-b border-line">
                    <th className="py-1.5 pr-4 font-normal">State</th>
                    <th className="py-1.5 pr-4 font-normal">Counties sent</th>
                    <th className="py-1.5 pr-4 font-normal">With votes</th>
                    <th className="py-1.5 pr-4 font-normal">Votes</th>
                    <th className="py-1.5 pr-4 font-normal">Since last check-in</th>
                    <th className="py-1.5 pr-4 font-normal">Saved</th>
                  </tr>
                </thead>
                <tbody>
                  {states.map((s) => {
                    const expected = COUNTIES[s.state];
                    const short = !s.statewide && expected && s.units < expected;
                    const failed = typeof s.saved === "string";
                    const moved = before.has(s.state) ? s.votes - (before.get(s.state) ?? 0) : null;
                    return (
                      <tr key={s.state} className={`border-b border-line ${failed ? "text-danger" : ""}`}>
                        <td className="py-1.5 pr-4">{s.state}</td>
                        <td className={`py-1.5 pr-4 ${short ? "text-danger" : ""}`}>
                          {s.statewide ? "statewide only" : expected ? `${s.units} of ${expected}` : s.units}
                        </td>
                        <td className="py-1.5 pr-4">{s.reporting}</td>
                        <td className="py-1.5 pr-4">{s.votes.toLocaleString()}</td>
                        <td className="py-1.5 pr-4 text-muted">
                          {moved === null ? "new" : moved === 0 ? "no change" : `${moved > 0 ? "+" : ""}${moved.toLocaleString()}`}
                        </td>
                        <td className="py-1.5 pr-4 text-xs">{failed ? s.saved : "ok"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {last.failed.length > 0 && (
            <ul className="flex flex-col gap-0.5 text-sm text-danger">
              {last.failed.map((f) => (
                <li key={f.state}>
                  {f.state} couldn&apos;t be read: <span className="text-xs">{f.error}</span>
                </li>
              ))}
            </ul>
          )}
          {last.waiting.length > 0 && (
            <p className="text-sm text-muted">No votes yet: {last.waiting.slice().sort().join(", ")}</p>
          )}
        </>
      )}
    </section>
  );
}
