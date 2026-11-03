"use client";

import { useEffect, useMemo, useState } from "react";
import { DEM, REP } from "@/lib/forecast";
import type { LiveRace, LiveSnapshot } from "@/lib/election/live";
import { ELECTION } from "@/lib/election/config";
import { ShareChart } from "./ShareChart";

type Shape = { name: string; d: string; cx: number; cy: number };

const POLL_MS = 60_000;

export function LiveBoard({
  initial,
  demo,
  history: initialHistory,
  shapes,
  borders,
  width,
  height,
}: {
  initial: LiveSnapshot;
  /** The ?demo percentage (0 for the real night). */
  demo?: number;
  history: { at: string; p: number }[];
  shapes: Shape[];
  borders: string;
  width: number;
  height: number;
}) {
  const [snap, setSnap] = useState(initial);
  const [history, setHistory] = useState(initialHistory);
  const [all, setAll] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const pickedRace = snap.races.find((r) => r.state === picked) ?? null;

  // Once a minute from just before the first polls close, fetch the newest snapshot.
  useEffect(() => {
    if (demo) return;
    const tick = async () => {
      if (Date.now() < Date.parse(ELECTION.start) - 5 * 60_000 || document.hidden) return;
      try {
        const res = await fetch("/api/election/latest", { cache: "no-store" });
        const next = (await res.json()) as LiveSnapshot | null;
        if (!next) return;
        setSnap((prev) => {
          if (prev.at !== next.at) setHistory((h) => [...h, { at: next.at, p: next.control.pDemControl }]);
          return next;
        });
      } catch {
        // Try again next minute.
      }
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [demo]);

  const races = useMemo(() => {
    const sorted = [...snap.races].sort((a, b) => b.margin.mean - a.margin.mean);
    if (all) return sorted;
    return sorted.filter(
      (r) =>
        (r.forecast.pOpp > 0.02 && r.forecast.pOpp < 0.98) ||
        (r.status === "live" && Math.abs(r.margin.mean) < 10) ||
        (r.pOpp > 0.02 && r.pOpp < 0.98),
    );
  }, [snap, all]);

  return (
    <div className="flex flex-col gap-10">
      <section className="grid items-center gap-8 md:grid-cols-[minmax(0,22rem)_1fr]">
        <Needle snap={snap} history={history} />
        <LiveMap
          races={snap.races}
          shapes={shapes}
          borders={borders}
          width={width}
          height={height}
          picked={picked}
          onPick={(state) => setPicked((p) => (p === state ? null : state))}
        />
      </section>

      {pickedRace && <ShareChart race={pickedRace} demo={demo ?? 0} onClose={() => setPicked(null)} />}

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-xs tracking-[0.12em] text-muted uppercase">Senate races</h2>
          <button type="button" onClick={() => setAll((a) => !a)} className="text-sm text-accent underline">
            {all ? "Close races only" : `All ${snap.races.length} races`}
          </button>
        </div>
        <RaceTable races={races} />
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------

const last = (name: string) => name.trim().split(/\s+/).pop() ?? name;
/** A chance out of 100; only a called race shows 100, so simulated odds stop at ">99". */
const pct = (raw: number) => {
  const p = Math.min(Math.max(raw, 0.0001), 0.9999);
  const n = Math.round(p * 100);
  if (n === 0 && p > 0) return "<1";
  if (n === 100 && p < 1) return ">99";
  return String(n);
};

/** "Ossoff +6.3" or "Even". */
function marginLabel(race: LiveRace, m: number) {
  if (Math.abs(m) < 0.05) return "Even";
  return `${last(m > 0 ? race.opp.name : race.rep.name)} +${Math.abs(m).toFixed(1)}`;
}

const sideColor = (m: number) => (m >= 0 ? DEM : REP);

export function oddsColor(race: LiveRace) {
  const p = race.called ? (race.called === "opp" ? 1 : 0) : race.pOpp;
  if (p >= 0.99) return "#2a62c9";
  if (p >= 0.85) return "#5a8fe6";
  if (p >= 0.6) return "#9dbcf0";
  if (p > 0.4) return "#a8a39a";
  if (p > 0.15) return "#f0a49d";
  if (p > 0.01) return "#e2675f";
  return "#c13a35";
}

// ---------------------------------------------------------------------------

function Needle({ snap, history }: { snap: LiveSnapshot; history: { at: string; p: number }[] }) {
  const p = snap.control.pDemControl;
  const angle = (p - 0.5) * 180; // -90 = certain Republican, +90 = certain Democratic
  const r = 120;
  const cx = 140;
  const cy = 140;
  const arc = (from: number, to: number) => {
    const a = ((from - 90) * Math.PI) / 180;
    const b = ((to - 90) * Math.PI) / 180;
    return `M ${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)} A ${r} ${r} 0 0 1 ${cx + r * Math.cos(b)} ${cy + r * Math.sin(b)}`;
  };
  // Five bands from Safe R to Safe D, like the needle's dial.
  const bands = [
    { from: -90, to: -54, color: REP, opacity: 0.9 },
    { from: -54, to: -18, color: REP, opacity: 0.45 },
    { from: -18, to: 18, color: "var(--muted)", opacity: 0.35 },
    { from: 18, to: 54, color: DEM, opacity: 0.45 },
    { from: 54, to: 90, color: DEM, opacity: 0.9 },
  ];
  const tip = ((angle - 90) * Math.PI) / 180;
  const demFavored = p >= 0.5;

  return (
    <div className="flex flex-col items-center gap-3">
      <h2 className="text-xs tracking-[0.12em] text-muted uppercase">Chance of controlling the Senate</h2>
      <svg viewBox="0 0 280 160" className="w-full max-w-80" role="img" aria-label={`Democrats ${pct(p)}% to control the Senate`}>
        {bands.map((b) => (
          <path key={b.from} d={arc(b.from, b.to)} stroke={b.color} strokeOpacity={b.opacity} strokeWidth={22} fill="none" />
        ))}
        <line
          x1={cx}
          y1={cy}
          x2={cx + (r - 4) * Math.cos(tip)}
          y2={cy + (r - 4) * Math.sin(tip)}
          stroke="var(--foreground)"
          strokeWidth={3}
          strokeLinecap="round"
          style={{ transition: "all 1.2s ease" }}
        />
        <circle cx={cx} cy={cy} r={7} fill="var(--foreground)" />
      </svg>
      <div className="flex w-full max-w-80 justify-between text-sm tabular-nums">
        <span style={{ color: REP }} className={demFavored ? "" : "font-semibold"}>
          Republicans {pct(1 - p)}%
        </span>
        <span style={{ color: DEM }} className={demFavored ? "font-semibold" : ""}>
          Democrats {pct(p)}%
        </span>
      </div>
      <p className="text-xs text-muted">
        Forecast said Democrats {pct(snap.control.forecastPDem)}% · about {Math.round(snap.control.demSeatsMean)} Democratic seats
      </p>
      {history.length > 1 && <Spark history={history} />}
    </div>
  );
}

function Spark({ history }: { history: { at: string; p: number }[] }) {
  const w = 280;
  const h = 48;
  const t0 = Date.parse(history[0].at);
  const t1 = Math.max(Date.parse(history[history.length - 1].at), t0 + 1);
  const pts = history.map((d) => `${((Date.parse(d.at) - t0) / (t1 - t0)) * w},${(1 - d.p) * h}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-80" aria-label="Democratic control odds through the night">
      <line x1={0} x2={w} y1={h / 2} y2={h / 2} stroke="var(--line)" strokeDasharray="3 3" />
      <polyline points={pts} fill="none" stroke="var(--foreground)" strokeWidth={1.5} />
    </svg>
  );
}

// ---------------------------------------------------------------------------

function LiveMap({
  races,
  shapes,
  borders,
  width,
  height,
  picked,
  onPick,
}: {
  races: LiveRace[];
  shapes: Shape[];
  borders: string;
  width: number;
  height: number;
  picked: string | null;
  onPick: (state: string) => void;
}) {
  const byName = new Map(races.map((r) => [r.name, r]));
  const [active, setActive] = useState<LiveRace | null>(null);
  const [at, setAt] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const track = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    setAt({ x: e.clientX - box.left, y: e.clientY - box.top, w: box.width, h: box.height });
  };
  return (
    <div className="flex flex-col gap-2" onPointerLeave={() => setActive(null)}>
      <div className="relative" onPointerMove={track} onPointerDown={track}>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Map of Senate races by live odds">
        {shapes.map((s) => {
          const race = byName.get(s.name);
          if (!race) return <path key={s.name} d={s.d} fill="var(--line)" />;
          return (
            <path
              key={s.name}
              d={s.d}
              fill={oddsColor(race)}
              className="cursor-pointer"
              onPointerEnter={() => setActive(race)}
              onPointerDown={() => setActive(race)}
              onClick={() => onPick(race.state)}
            />
          );
        })}
        <path d={borders} fill="none" stroke="var(--background)" strokeWidth={1} pointerEvents="none" />
        {shapes
          .filter((s) => byName.get(s.name)?.state === picked)
          .map((s) => (
            <path key={s.name} d={s.d} fill="none" stroke="var(--foreground)" strokeWidth={2.5} pointerEvents="none" />
          ))}
        {races
          .filter((r) => r.called)
          .map((r) => {
            const s = shapes.find((x) => x.name === r.name);
            return s ? <circle key={r.state} cx={s.cx} cy={s.cy} r={7} fill="var(--background)" stroke="var(--foreground)" strokeWidth={2} pointerEvents="none" /> : null;
          })}
      </svg>
      {active && at && <Tally race={active} at={at} />}
      </div>
      <p className="min-h-5 text-center text-sm tabular-nums">
        {active ? (
          <>
            <span className="font-medium">{active.name}</span> · {statusText(active)}
            {active.status !== "forecast" && active.votes.total > 0 && <> · now {marginLabel(active, nowMargin(active))}</>}
            {" · "}
            <span style={{ color: sideColor(active.pOpp - 0.5) }}>{winText(active)}</span>
          </>
        ) : (
          <span className="text-muted">Click a state for its live vote-share chart. Circles mark races WMHQ has called.</span>
        )}
      </p>
    </div>
  );
}

/** The current count for the state under the pointer, like a results table: Dem, Rep and everyone else. */
function Tally({ race, at }: { race: LiveRace; at: { x: number; y: number; w: number; h: number } }) {
  const { rep, opp, other, total } = race.votes;
  const rows = [
    { name: race.opp.name, party: race.opp.party === "I" ? "Ind." : "Dem.", votes: opp, color: DEM },
    { name: race.rep.name, party: "Rep.", votes: rep, color: REP },
    { name: "Others", party: "", votes: other, color: "var(--muted)" },
  ].sort((a, b) => b.votes - a.votes || (a.name === "Others" ? 1 : b.name === "Others" ? -1 : 0));
  const share = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);
  const left = at.x > at.w / 2;
  const up = at.y > at.h * 0.55;
  return (
    <div
      className="pointer-events-none absolute z-10 w-72 max-w-[85vw] rounded-md border border-line bg-background p-3 text-sm shadow-lg"
      style={{
        left: at.x + (left ? -14 : 14),
        top: at.y + (up ? -14 : 14),
        transform: `translate(${left ? "-100%" : "0"}, ${up ? "-100%" : "0"})`,
      }}
    >
      <p className="mb-1 text-base font-semibold">{race.name}{race.special && <span className="font-normal text-muted"> (special)</span>}</p>
      <table className="w-full tabular-nums">
        <thead className="text-xs text-muted">
          <tr className="border-b border-line">
            <th className="py-1 text-left font-normal">Candidate</th>
            <th className="py-1 text-left font-normal">Party</th>
            <th className="py-1 text-right font-normal">Votes</th>
            <th className="py-1 text-right font-normal">Pct.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.name} className="border-b border-line">
              <td className="py-1 pr-2">
                <span className="mr-2 inline-block h-4 w-1 align-middle" style={{ background: r.color }} />
                {r.name}
              </td>
              <td className="py-1 pr-2 text-muted">{r.party}</td>
              <td className="py-1 text-right">{Math.round(r.votes).toLocaleString()}</td>
              <td className="py-1 text-right font-semibold">
                {share(r.votes)}
                {i === 0 && "%"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-xs text-muted">
        {race.status === "live" ? `${Math.round(race.counted * 100)}% of votes in` : statusText(race)}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------

const nowMargin = (r: LiveRace) => (r.votes.total ? ((r.votes.opp - r.votes.rep) / r.votes.total) * 100 : 0);

function statusText(r: LiveRace) {
  if (r.status === "forecast") return "No live results";
  if (Date.now() < Date.parse(r.pollsClose) && r.votes.total === 0) {
    return `Polls close ${new Date(r.pollsClose).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })}`;
  }
  if (r.status === "waiting") return "Waiting for votes";
  return `${Math.round(r.counted * 100)}% counted`;
}

function winText(r: LiveRace) {
  if (r.called) return `${last(r.called === "opp" ? r.opp.name : r.rep.name)} wins ✓`;
  const opp = r.pOpp >= 0.5;
  return `${last(opp ? r.opp.name : r.rep.name)} ${pct(opp ? r.pOpp : 1 - r.pOpp)}%`;
}

type Scale = { ticks: number[]; x: (m: number) => number };

function scaleFor(races: LiveRace[]): Scale {
  const extent = Math.min(40, Math.max(8, ...races.flatMap((r) => [Math.abs(r.margin.p5), Math.abs(r.margin.p95)])));
  const step = extent > 16 ? 10 : extent > 8 ? 5 : 2;
  const domain = Math.ceil(extent / step) * step;
  const ticks: number[] = [];
  for (let t = -domain; t <= domain; t += step) ticks.push(t);
  return { ticks, x: (m: number) => ((Math.max(-domain, Math.min(domain, m)) + domain) / (2 * domain)) * 100 };
}

function Axis({ scale, className = "" }: { scale: Scale; className?: string }) {
  const { ticks, x } = scale;
  return (
    <div className={`relative h-4 ${className}`}>
      {ticks.map((t, i) => (
        <span
          key={t}
          className={`absolute tabular-nums ${i === 0 ? "" : i === ticks.length - 1 ? "-translate-x-full" : "-translate-x-1/2"}`}
          style={{ left: `${x(t)}%` }}
        >
          {t === 0 ? "Even" : t > 0 ? `D+${t}` : `R+${-t}`}
        </span>
      ))}
    </div>
  );
}

function MarginBar({ race, scale }: { race: LiveRace; scale: Scale }) {
  const { ticks, x } = scale;
  const proj = race.margin.mean;
  return (
    <div className="relative h-5" aria-hidden>
      {ticks.map((t) => (
        <span
          key={t}
          className="absolute inset-y-0 w-px"
          style={{ left: `${x(t)}%`, background: t === 0 ? "var(--muted)" : "var(--line)" }}
        />
      ))}
      <Band from={x(race.margin.p5)} to={x(race.margin.p95)} m={proj} opacity={0.3} height="45%" />
      <Band from={x(race.margin.p25)} to={x(race.margin.p75)} m={proj} opacity={0.6} height="85%" />
      <span
        className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ left: `${x(proj)}%`, background: sideColor(proj), transition: "left 1s ease" }}
      />
    </div>
  );
}

function RaceName({ r }: { r: LiveRace }) {
  return (
    <span className="truncate pl-1">
      {r.name}
      {r.special && <span className="text-muted"> (sp.)</span>}
      {r.rankedChoice && (
        <span className="text-muted" title="Ranked-choice voting: this is the first round.">
          {" "}
          RCV
        </span>
      )}
    </span>
  );
}

function WinCell({ r }: { r: LiveRace }) {
  return (
    <span className="text-right font-semibold whitespace-nowrap" style={{ color: sideColor(r.pOpp - 0.5) }}>
      {winText(r)}
      {r.pRunoff !== undefined && r.pRunoff > 0.05 && !r.called && (
        <span className="block text-xs font-normal text-muted">runoff {pct(r.pRunoff)}%</span>
      )}
    </span>
  );
}

// Share of the expected vote counted so far, for every race (0% before results).
const counted = (r: LiveRace) => `${Math.round((r.status === "live" ? r.counted : 0) * 100)}%`;

/** "D+4.1" / "R+2.0": the current count's margin, short for phones. */
function shortMargin(r: LiveRace, m: number) {
  if (Math.abs(m) < 0.05) return "Even";
  const letter = m > 0 ? (r.opp.party === "I" ? "I" : "D") : "R";
  return `${letter}+${Math.abs(m).toFixed(1)}`;
}

function RaceTable({ races }: { races: LiveRace[] }) {
  const scale = scaleFor(races);
  return (
    <>
      <DesktopTable races={races} scale={scale} />
      <PhoneTables races={races} scale={scale} />
    </>
  );
}

// Wide screens: one table, the margin chart in the last column like the NYT's.
function DesktopTable({ races, scale }: { races: LiveRace[]; scale: Scale }) {
  const cols = "grid grid-cols-[minmax(7rem,1fr)_4.5rem_7.5rem_8.5rem_7.5rem_minmax(14rem,2.4fr)] [&>*:nth-child(6)]:ml-3";
  return (
    <div className="hidden flex-col text-sm md:flex">
      <div className={`${cols} items-end gap-x-3 border-b border-line pb-2 text-xs text-muted`}>
        <span>Race</span>
        <span className="text-right">Votes in</span>
        <span className="text-right">Current</span>
        <span className="text-right">Win prob.</span>
        <span className="text-right">Est. final</span>
        <Axis scale={scale} />
      </div>
      {races.map((r) => {
        const proj = r.margin.mean;
        return (
          <div key={r.state} className={`${cols} items-center gap-x-3 border-b border-line py-2 tabular-nums`}>
            <RaceName r={r} />
            <span className="text-right text-muted">{counted(r)}</span>
            <span className="text-right">
              {r.votes.total > 0 ? (
                <span style={{ color: sideColor(nowMargin(r)) }}>{marginLabel(r, nowMargin(r))}</span>
              ) : (
                <span className="text-muted">–</span>
              )}
            </span>
            <WinCell r={r} />
            <span className="text-right" style={{ color: sideColor(proj) }}>
              {marginLabel(r, proj)}
            </span>
            <MarginBar race={r} scale={scale} />
          </div>
        );
      })}
    </div>
  );
}

// Phones: the live count and odds in one table, the projected margins in a
// second one below, so each fits the width.
function PhoneTables({ races, scale }: { races: LiveRace[]; scale: Scale }) {
  const top = "grid grid-cols-[minmax(0,1fr)_2.75rem_3.75rem_minmax(6.5rem,auto)]";
  const bottom = "grid grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)]";
  return (
    <div className="flex flex-col gap-8 md:hidden">
      <div className="flex flex-col text-sm">
        <div className={`${top} items-end gap-x-2 border-b border-line pb-2 text-xs text-muted`}>
          <span>Race</span>
          <span className="text-right">In</span>
          <span className="text-right">Now</span>
          <span className="text-right">Win prob.</span>
        </div>
        {races.map((r) => (
          <div key={r.state} className={`${top} items-center gap-x-2 border-b border-line py-2 tabular-nums`}>
            <RaceName r={r} />
            <span className="text-right text-muted">{counted(r)}</span>
            <span className="text-right">
              {r.votes.total > 0 ? (
                <span style={{ color: sideColor(nowMargin(r)) }}>{shortMargin(r, nowMargin(r))}</span>
              ) : (
                <span className="text-muted">–</span>
              )}
            </span>
            <WinCell r={r} />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 text-sm">
        <h3 className="text-xs tracking-[0.12em] text-muted uppercase">Projected final margin</h3>
        <div className={`${bottom} items-end gap-x-3 border-b border-line pb-2 text-xs text-muted`}>
          <span>Race</span>
          <Axis scale={scale} />
        </div>
        {races.map((r) => {
          const proj = r.margin.mean;
            return (
            <div key={r.state} className={`${bottom} items-center gap-x-3 border-b border-line py-1.5 tabular-nums`}>
              <span className="flex min-w-0 flex-col pl-1 leading-tight">
                <span className="truncate">{r.name}</span>
                <span className="truncate text-xs" style={{ color: sideColor(proj) }}>
                  {marginLabel(r, proj)}
                </span>
              </span>
              <MarginBar race={r} scale={scale} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Band({ from, to, m, opacity, height }: { from: number; to: number; m: number; opacity: number; height: string }) {
  // Part of a band past Even takes the other side's color, like the NYT table.
  const zero = 50;
  const parts =
    from < zero && to > zero
      ? [
          { a: from, b: zero, color: REP },
          { a: zero, b: to, color: DEM },
        ]
      : [{ a: from, b: to, color: sideColor(m) }];
  return (
    <>
      {parts.map((p) => (
        <span
          key={p.a}
          className="absolute top-1/2 -translate-y-1/2"
          style={{ left: `${p.a}%`, width: `${Math.max(p.b - p.a, 0.4)}%`, height, background: p.color, opacity, transition: "all 1s ease" }}
        />
      ))}
    </>
  );
}
