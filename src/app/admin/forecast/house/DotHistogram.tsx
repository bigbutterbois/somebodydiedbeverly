"use client";

import { useEffect, useRef, useState } from "react";
import { DEM, REP, seatDots } from "@/lib/forecast";

const PAD = { top: 8, right: 8, bottom: 44, left: 8 };

// Many simulations as small dots, stacked by how many seats Democrats win:
// blue where Democrats control the House. Static, unlike the Senate version,
// since one House simulation's map isn't worth hovering over.
export function DotHistogram({
  distribution,
  dots = 500,
  majority,
  total,
}: {
  distribution: Record<string, number>;
  dots?: number;
  majority: number;
  total: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(720);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setW(Math.max(280, Math.round(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const counts = seatDots(distribution, dots);
  const seats = [...counts.keys()];
  const lo = Math.min(...seats, majority - 1) - 1;
  const hi = Math.max(...seats, majority) + 1;
  const colW = (W - PAD.left - PAD.right) / (hi - lo + 1);
  const r = Math.max(1.2, Math.min(3.5, colW / 2 - 0.4));
  const step = 2 * r + 0.8;
  const H = PAD.top + Math.max(...counts.values()) * step + PAD.bottom;
  const cx = (s: number) => PAD.left + (s - lo + 0.5) * colW;
  const base = H - PAD.bottom;
  const line = majority - 0.5;
  const labelEvery = [1, 2, 5, 10, 20].find((n) => n * colW >= 28) ?? 20;
  const labels = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).filter((s) => s % labelEvery === 0);

  return (
    <div ref={ref}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Democratic seats in ${dots} simulations, from ${seats[0]} to ${seats[seats.length - 1]} of ${total}.`}
      >
        <line x1={cx(line)} x2={cx(line)} y1={PAD.top} y2={base + 6} stroke="var(--muted)" strokeDasharray="3 3" />
        <line x1={PAD.left} x2={W - PAD.right} y1={base + 0.5} y2={base + 0.5} stroke="var(--line)" />
        {seats.map((s) =>
          Array.from({ length: counts.get(s)! }, (_, k) => (
            <circle key={`${s}-${k}`} cx={cx(s)} cy={base - r - 1 - k * step} r={r} fill={s >= majority ? DEM : REP} />
          )),
        )}
        {labels.map((s) => (
          <text key={s} x={cx(s)} y={base + 16} textAnchor="middle" className="fill-muted text-[11px] tabular-nums">
            {s}
          </text>
        ))}
        <text x={cx(line) - 6} y={base + 34} textAnchor="end" className="fill-muted text-[11px]">
          ← Republican control
        </text>
        <text x={cx(line) + 6} y={base + 34} className="fill-muted text-[11px]">
          Democratic control →
        </text>
      </svg>
    </div>
  );
}
