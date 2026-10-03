"use client";

import { useEffect, useRef, useState } from "react";
import { DEM, REP } from "@/lib/forecast";

const PAD = { top: 8, right: 8, bottom: 44, left: 8 };
const DOTS = 100;

// 100 representative simulations as dots, stacked by how many seats Democrats
// win. Blue dots are outcomes where Democrats control the Senate.
export function SeatHistogram({ distribution, total = 100 }: { distribution: Record<string, number>; total?: number }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [W, setW] = useState(720);
  useEffect(() => {
    const el = svgRef.current?.parentElement;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setW(Math.max(280, Math.round(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const counts = toDots(distribution);
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
    const s = Math.round((px - PAD.left) / colW - 0.5) + lo;
    setHover(counts.has(s) ? s : null);
  }

  const hoverCount = hover === null ? 0 : counts.get(hover)!;

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-none select-none"
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
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
          style={{
            left: `${(cx(hover) / W) * 100}%`,
            transform: cx(hover) > W / 2 ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
          }}
        >
          <p>
            <span style={{ color: DEM }}>{hover} D</span> · <span style={{ color: REP }}>{total - hover} R</span>
          </p>
          <p className="text-muted">
            {hoverCount} of 100 simulations
          </p>
        </div>
      )}
    </div>
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
