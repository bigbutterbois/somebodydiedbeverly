"use client";

import { useEffect, useState } from "react";
import { DEM, REP } from "@/lib/forecast";
import { projectedShares, SHARE_CHART, type LiveRace } from "@/lib/election/live";

type Point = { at: string; s: number[] };

// Phones get a narrower drawing so its labels stay readable.
const SIZES = { wide: { W: 640, H: 300 }, narrow: { W: 400, H: 280 } };
const PAD = { left: 44, right: 64, top: 12, bottom: 30 };
const T0 = Date.parse(SHARE_CHART.from);
const T1 = Date.parse(SHARE_CHART.to);

const last = (name: string) => name.trim().split(/\s+/).pop() ?? name;

/**
 * One race's projected final vote share for both main candidates from 6pm to
 * 6am Eastern, with the shaded range the result should land in 9 times out
 * of 10. The range narrows as more of the vote is counted.
 */
export function ShareChart({ race, demo, onClose }: { race: LiveRace; demo: number; onClose: () => void }) {
  const [loaded, setLoaded] = useState<{ state: string; points: Point[] } | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/election/history?state=${race.state}${demo ? `&demo=${demo}` : ""}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((points: Point[]) => live && setLoaded({ state: race.state, points }))
      .catch(() => live && setLoaded({ state: race.state, points: [] }));
    return () => {
      live = false;
    };
  }, [race.state, demo]);

  const history = loaded?.state === race.state ? loaded.points : null;
  // The newest projection rides along with each minute's update, so add it
  // to the end until the next fetch includes it.
  const latest: Point = { at: demo ? "2026-11-04T03:00:00Z" : new Date().toISOString(), s: projectedShares(race) };
  const points = history ? withLatest(clip(history), latest, Boolean(demo)) : [];

  const oppColor = DEM;
  const now = points.at(-1);

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-line p-4" aria-label={`${race.name} projected vote share`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg">
            {race.name}
            {race.special && <span className="text-muted"> (special)</span>}
          </h2>
          <p className="text-sm text-muted">
            Projected final vote share:{" "}
            <span style={{ color: oppColor }}>
              {race.opp.name} ({race.opp.party})
            </span>{" "}
            vs{" "}
            <span style={{ color: REP }}>
              {race.rep.name} ({race.rep.party})
            </span>
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-sm text-muted underline" aria-label="Close chart">
          Close
        </button>
      </div>

      {history === null ? (
        <p className="py-16 text-center text-sm text-muted">Loading…</p>
      ) : points.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">The chart starts when the first polls close at 6pm Eastern.</p>
      ) : (
        <>
          <div className="hidden sm:block">
            <Chart size="wide" points={points} oppColor={oppColor} oppName={last(race.opp.name)} repName={last(race.rep.name)} />
          </div>
          <div className="sm:hidden">
            <Chart size="narrow" points={points} oppColor={oppColor} oppName={last(race.opp.name)} repName={last(race.rep.name)} />
          </div>
        </>
      )}

      <p className="text-xs text-muted">
        Shading shows the range each candidate&apos;s final share should land in 9 times out of 10. It narrows as more
        of the vote is counted.
        {now && race.status !== "live" && " No votes are counted here yet, so this is still the forecast."}
      </p>
    </section>
  );
}

/** Points from 6pm on; the last one before 6pm (the forecast) is moved to 6pm as the starting point. */
function clip(points: Point[]): Point[] {
  const before = points.filter((p) => Date.parse(p.at) < T0);
  const after = points.filter((p) => Date.parse(p.at) >= T0 && Date.parse(p.at) <= T1);
  const start = before.at(-1);
  return start ? [{ at: SHARE_CHART.from, s: start.s }, ...after] : after;
}

function withLatest(points: Point[], latest: Point, demo: boolean): Point[] {
  const t = Date.parse(latest.at);
  if (t < T0 || t > T1) return points;
  const end = points.at(-1);
  if (end && (demo || Date.parse(end.at) >= t - 30_000)) return points;
  return [...points, latest];
}

function Chart({
  size,
  points,
  oppColor,
  oppName,
  repName,
}: {
  size: keyof typeof SIZES;
  points: Point[];
  oppColor: string;
  oppName: string;
  repName: string;
}) {
  const { W, H } = SIZES[size];
  const lows = points.flatMap((p) => [p.s[1], p.s[4]]);
  const highs = points.flatMap((p) => [p.s[2], p.s[5]]);
  const range = Math.max(...highs) - Math.min(...lows);
  const step = range > 40 ? 10 : range > 20 ? 5 : range > 12 && size === "narrow" ? 4 : 2;
  const y0 = Math.max(0, Math.floor(Math.min(...lows) / step) * step);
  const y1 = Math.min(100, Math.ceil(Math.max(...highs) / step) * step);
  const ticks: number[] = [];
  for (let v = y0; v <= y1; v += step) ticks.push(v);

  const x = (at: string) => PAD.left + ((Date.parse(at) - T0) / (T1 - T0)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - y0) / Math.max(y1 - y0, 1)) * (H - PAD.top - PAD.bottom);

  const line = (i: number) => points.map((p) => `${x(p.at).toFixed(1)},${y(p.s[i]).toFixed(1)}`).join(" ");
  const band = (lo: number, hi: number) =>
    [...points.map((p) => `${x(p.at).toFixed(1)},${y(p.s[hi]).toFixed(1)}`), ...points.toReversed().map((p) => `${x(p.at).toFixed(1)},${y(p.s[lo]).toFixed(1)}`)].join(" ");

  const every = size === "narrow" ? 3 : 2;
  const hours = Array.from({ length: 12 / every + 1 }, (_, i) => new Date(T0 + i * every * 3_600_000).toISOString());
  const hourLabel = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", timeZone: "America/New_York" }).replace(" ", "").toLowerCase();

  const end = points.at(-1)!;
  const ex = x(end.at);
  // Keep the two end labels from overlapping when the race is close.
  let oy = y(end.s[0]);
  let ry = y(end.s[3]);
  if (Math.abs(oy - ry) < 18) {
    const mid = (oy + ry) / 2;
    const up = end.s[0] >= end.s[3];
    oy = mid + (up ? -9 : 9);
    ry = mid + (up ? 9 : -9);
  }
  const lines = [
    { i: 0, color: oppColor, name: oppName, labelY: oy },
    { i: 3, color: REP, name: repName, labelY: ry },
  ];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${oppName} ${end.s[0]}%, ${repName} ${end.s[3]}%`}>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--line)" />
          <text x={PAD.left - 8} y={y(v)} dy="0.35em" textAnchor="end" fontSize={13} fill="var(--muted)" className="tabular-nums">
            {v}%
          </text>
        </g>
      ))}
      {hours.map((h) => (
        <text key={h} x={x(h)} y={H - 8} textAnchor="middle" fontSize={13} fill="var(--muted)">
          {hourLabel(h)}
        </text>
      ))}
      <polygon points={band(4, 5)} fill={REP} opacity={0.18} />
      <polygon points={band(1, 2)} fill={oppColor} opacity={0.18} />
      {lines.map((l) => (
        <g key={l.i}>
          <polyline points={line(l.i)} fill="none" stroke="var(--background)" strokeWidth={5} strokeLinejoin="round" />
          <polyline points={line(l.i)} fill="none" stroke={l.color} strokeWidth={2.5} strokeLinejoin="round" />
          <circle cx={ex} cy={y(end.s[l.i])} r={4.5} fill={l.color} />
          <text x={ex + 10} y={l.labelY} dy="0.35em" fontSize={15} fontWeight={600} fill={l.color} className="tabular-nums">
            {Math.round(end.s[l.i])}%
          </text>
        </g>
      ))}
      <line x1={ex} x2={ex} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--muted)" strokeDasharray="2 3" />
    </svg>
  );
}
