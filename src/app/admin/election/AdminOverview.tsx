"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { LiveRace } from "@/lib/election/live";
import { DEM, REP } from "@/lib/forecast";
import { oddsColor } from "../../(site)/election/LiveBoard";

type Shape = { name: string; d: string; cx: number; cy: number };
type History = { at: string; odds: Record<string, number> }[];

// Admin → Election's top half: a map to jump into any state's county sheet,
// and one row per race with a small chart of the Democrat's (or the
// independent's) odds through the night, so a sudden swing stands out.
export function AdminOverview({
  races,
  history,
  shapes,
  borders,
  width,
  height,
}: {
  races: LiveRace[];
  history: History;
  shapes: Shape[];
  borders: string;
  width: number;
  height: number;
}) {
  const router = useRouter();
  const byName = new Map(races.map((r) => [r.name, r]));
  const [hover, setHover] = useState<LiveRace | null>(null);
  const sorted = [...races].sort((a, b) => Math.abs(a.pOpp - 0.5) - Math.abs(b.pOpp - 0.5));

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full max-w-3xl" role="img" aria-label="Pick a state">
          {shapes.map((s) => {
            const race = byName.get(s.name);
            if (!race) return <path key={s.name} d={s.d} fill="var(--line)" />;
            return (
              <path
                key={s.name}
                d={s.d}
                fill={oddsColor(race)}
                className="cursor-pointer hover:opacity-80"
                onPointerEnter={() => setHover(race)}
                onPointerLeave={() => setHover(null)}
                onClick={() => router.push(`/admin/election/${race.state}`)}
              />
            );
          })}
          <path d={borders} fill="none" stroke="var(--background)" strokeWidth={1} pointerEvents="none" />
        </svg>
        <p className="min-h-5 text-sm text-muted">
          {hover ? `${hover.name}: ${pct(hover.pOpp)} ${last(hover.opp.name)} · click for county sheet` : "Click a state for its county sheet."}
        </p>
      </section>

      <section className="flex flex-col gap-2 overflow-x-auto">
        <h2 className="text-xs uppercase tracking-[0.12em] text-muted">Races, closest first</h2>
        <table className="w-full text-left text-sm tabular-nums">
          <thead className="text-xs uppercase tracking-[0.12em] text-muted">
            <tr className="border-b border-line">
              <th className="py-2 pr-4 font-normal">Race</th>
              <th className="py-2 pr-4 font-normal">D / I odds</th>
              <th className="py-2 pr-4 font-normal">Last 15 min</th>
              <th className="py-2 pr-4 font-normal">Counted</th>
              <th className="py-2 pr-4 font-normal">Through the night</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const series = history.filter((h) => h.odds[r.state] !== undefined).map((h) => ({ at: h.at, p: h.odds[r.state] }));
              const ago = series.findLast((d) => Date.parse(d.at) <= Date.now() - 15 * 60_000);
              const change = ago ? r.pOpp - ago.p : null;
              return (
                <tr key={r.state} className="border-b border-line">
                  <td className="py-2 pr-4">
                    <Link href={`/admin/election/${r.state}`} className="underline">
                      {r.name}
                      {r.special ? " (special)" : ""}
                    </Link>
                    <span className="ml-2 text-xs text-muted">
                      {last(r.opp.name)} v {last(r.rep.name)}
                    </span>
                  </td>
                  <td className="py-2 pr-4" style={{ color: r.pOpp >= 0.5 ? DEM : REP }}>
                    {pct(r.pOpp)}
                  </td>
                  <td className={`py-2 pr-4 ${change !== null && Math.abs(change) >= 0.1 ? "font-medium text-danger" : "text-muted"}`}>
                    {change === null ? "–" : pts(change)}
                  </td>
                  <td className="py-2 pr-4 text-muted">{r.status === "live" ? `${Math.round(r.counted * 100)}%` : "–"}</td>
                  <td className="py-2 pr-4">
                    <Spark series={series} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Spark({ series }: { series: { at: string; p: number }[] }) {
  const w = 160;
  const h = 32;
  if (series.length < 2) return <span className="text-xs text-muted">no history yet</span>;
  const t0 = Date.parse(series[0].at);
  const t1 = Math.max(Date.parse(series[series.length - 1].at), t0 + 1);
  const pts = series.map((d) => `${(((Date.parse(d.at) - t0) / (t1 - t0)) * w).toFixed(1)},${((1 - d.p) * h).toFixed(1)}`).join(" ");
  const lastP = series[series.length - 1].p;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-label="Odds through the night">
      <line x1={0} x2={w} y1={h / 2} y2={h / 2} stroke="var(--line)" strokeDasharray="3 3" />
      <polyline points={pts} fill="none" stroke={lastP >= 0.5 ? DEM : REP} strokeWidth={1.5} />
    </svg>
  );
}

// "+12 pts" / "−3 pts" / "0 pts", in percentage points of the D / I odds.
function pts(change: number) {
  const n = Math.round(change * 100);
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)} pts`;
}

const last = (name: string) => name.trim().split(/\s+/).pop() ?? name;
const pct = (p: number) => (p > 0.99 ? ">99%" : p < 0.01 ? "<1%" : `${Math.round(p * 100)}%`);
