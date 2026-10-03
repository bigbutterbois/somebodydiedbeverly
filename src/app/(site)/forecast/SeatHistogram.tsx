"use client";

import { useEffect, useRef, useState } from "react";
import { DEM, REP, type SampleSimulation } from "@/lib/forecast";

type Shape = { name: string; d: string };

const PAD = { top: 8, right: 8, bottom: 44, left: 8 };
const DOTS = 100;

// 100 representative simulations as dots, stacked by how many seats Democrats
// win. Blue dots are outcomes where Democrats control the Senate. Hovering a dot
// shows that simulation's map.
export function SeatHistogram({
  distribution,
  samples,
  raceNames,
  shapes,
  borders,
  total = 100,
}: {
  distribution: Record<string, number>;
  samples?: SampleSimulation[];
  raceNames: string[];
  shapes: Shape[];
  borders: string;
  total?: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverDot, setHoverDot] = useState<{ s: number; k: number } | null>(null);
  const hover = hoverDot?.s ?? null;
  const [W, setW] = useState(720);
  useEffect(() => {
    const el = svgRef.current?.parentElement;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setW(Math.max(280, Math.round(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Simulations stacked by seat count, or plain dots from the distribution for older data.
  const stacks = new Map<number, (SampleSimulation | null)[]>();
  if (samples?.length) {
    for (const sim of [...samples].sort((a, b) => a.dem_seats - b.dem_seats)) {
      stacks.set(sim.dem_seats, [...(stacks.get(sim.dem_seats) ?? []), sim]);
    }
  } else {
    for (const [s, n] of toDots(distribution)) stacks.set(s, Array(n).fill(null));
  }
  const counts = new Map([...stacks].map(([s, list]) => [s, list.length]));
  const seats = [...counts.keys()];
  const lo = Math.min(...seats, 50) - 1;
  const hi = Math.max(...seats, 51) + 1;
  const cols = hi - lo + 1;
  const colW = (W - PAD.left - PAD.right) / cols;
  const r = Math.max(2.5, Math.min(7, colW / 2 - 1.5));
  const maxStack = Math.max(...counts.values());
  const H = PAD.top + maxStack * (2 * r + 2) + PAD.bottom;
  const cx = (s: number) => PAD.left + (s - lo + 0.5) * colW;
  const base = H - PAD.bottom;
  const labelEvery = colW < 22 ? 2 : 1;
  const controls = (s: number) => s >= 51; // Vance breaks a 50-50 tie for Republicans

  function onMove(e: React.PointerEvent) {
    const box = svgRef.current!.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const py = ((e.clientY - box.top) / box.height) * H;
    const s = Math.round((px - PAD.left) / colW - 0.5) + lo;
    const n = counts.get(s) ?? 0;
    // Nearest dot in the column; below the axis or above the stack picks the closest end.
    const k = Math.min(n - 1, Math.max(0, Math.floor((base - py) / (2 * r + 2))));
    setHoverDot(n > 0 ? { s, k } : null);
  }

  const sim = hoverDot ? stacks.get(hoverDot.s)?.[hoverDot.k] ?? null : null;

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-none select-none"
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHoverDot(null)}
        role="img"
        aria-label={`Democratic seats in 100 simulations: ${seats.map((s) => `${s} seats in ${counts.get(s)}`).join(", ")}.`}
      >
        {/* Control line between 50 and 51 Democratic seats. */}
        <line x1={cx(50.5)} x2={cx(50.5)} y1={PAD.top} y2={base + 6} stroke="var(--muted)" strokeDasharray="3 3" />
        <line x1={PAD.left} x2={W - PAD.right} y1={base + 0.5} y2={base + 0.5} stroke="var(--line)" />
        {seats.map((s) =>
          Array.from({ length: counts.get(s)! }, (_, k) => (
            <circle
              key={`${s}-${k}`}
              cx={cx(s)}
              cy={base - r - 1 - k * (2 * r + 2)}
              r={r}
              fill={controls(s) ? DEM : REP}
              opacity={hover === null || hover === s ? 1 : 0.35}
              stroke={hoverDot?.s === s && hoverDot.k === k ? "var(--foreground)" : "none"}
              strokeWidth={2}
            />
          )),
        )}
        {Array.from({ length: cols }, (_, i) => lo + i)
          .filter((s) => (s - 50) % labelEvery === 0 || s === hover)
          .map((s) => (
            <g key={s}>
              <text
                x={cx(s)}
                y={base + 16}
                textAnchor="middle"
                className={`text-[11px] tabular-nums ${s === hover ? "fill-foreground" : "fill-muted"}`}
              >
                {s}
              </text>
            </g>
          ))}
        <text x={cx(50.5) - 6} y={base + 34} textAnchor="end" className="fill-muted text-[11px]">
          ← Republican control
        </text>
        <text x={cx(50.5) + 6} y={base + 34} className="fill-muted text-[11px]">
          Democratic control →
        </text>
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-0 rounded border border-line bg-background/95 px-3 py-2 text-xs tabular-nums shadow-lg"
          style={
            W < 500
              ? { left: "50%", transform: "translateX(-50%)" } // too narrow to sit beside the column
              : {
                  left: `${(cx(hover) / W) * 100}%`,
                  transform: cx(hover) > W / 2 ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
                }
          }
        >
          <p>
            <span style={{ color: DEM }}>{hover} D</span> · <span style={{ color: REP }}>{total - hover} R</span>
          </p>
          {sim && <MiniMap sim={sim} raceNames={raceNames} shapes={shapes} borders={borders} />}
        </div>
      )}
    </div>
  );
}

function MiniMap({
  sim,
  raceNames,
  shapes,
  borders,
}: {
  sim: SampleSimulation;
  raceNames: string[];
  shapes: Shape[];
  borders: string;
}) {
  const winner = new Map(raceNames.map((name, i) => [name, sim.winners[i]]));
  return (
    <svg viewBox="0 0 975 610" className="mt-2 h-auto w-56" aria-hidden>
      {shapes.map((s) => {
        const w = winner.get(s.name);
        return <path key={s.name} d={s.d} fill={w === "D" ? DEM : w === "R" ? REP : "var(--line)"} />;
      })}
      <path d={borders} fill="none" stroke="var(--background)" strokeWidth={2} strokeLinejoin="round" />
    </svg>
  );
}

/** Round the seat distribution to 100 dots (largest remainder), keyed by Democratic seats. */
function toDots(distribution: Record<string, number>) {
  const entries = Object.entries(distribution).map(([s, p]) => ({ s: Number(s), exact: p * DOTS }));
  const base = entries.map((e) => ({ ...e, n: Math.floor(e.exact) }));
  let left = DOTS - base.reduce((sum, e) => sum + e.n, 0);
  for (const e of [...base].sort((a, b) => b.exact - b.n - (a.exact - a.n))) {
    if (left-- <= 0) break;
    e.n += 1;
  }
  return new Map(base.filter((e) => e.n > 0).sort((a, b) => a.s - b.s).map((e) => [e.s, e.n]));
}
