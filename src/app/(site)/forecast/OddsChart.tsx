"use client";

import { useEffect, useRef, useState } from "react";
import { DEM, REP, formatDay, type HistoryPoint } from "@/lib/forecast";

const PAD = { top: 16, right: 84, bottom: 28, left: 40 };

const dayNumber = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86_400_000;

// Chance of Senate control by day, from the first forecast through election day.
export function OddsChart({ history, electionDay }: { history: HistoryPoint[]; electionDay: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  // Draw at the container's real width so text stays a readable size on phones.
  const [W, setW] = useState(720);
  const H = W < 500 ? 220 : 260;
  useEffect(() => {
    const el = svgRef.current?.parentElement;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setW(Math.max(280, Math.round(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const start = dayNumber(history[0].date);
  const end = Math.max(dayNumber(electionDay), dayNumber(history[history.length - 1].date));
  const x = (iso: string) => PAD.left + ((dayNumber(iso) - start) / Math.max(end - start, 1)) * (W - PAD.left - PAD.right);
  const y = (p: number) => PAD.top + (1 - p) * (H - PAD.top - PAD.bottom);
  const line = (key: "p_dem_control" | "p_rep_control") =>
    history.map((h, i) => `${i ? "L" : "M"}${x(h.date).toFixed(1)},${y(h[key]).toFixed(1)}`).join("");

  const last = history[history.length - 1];
  const point = hover === null ? null : history[hover];
  const ticks = monthTicks(history[0].date, electionDay);

  function onMove(e: React.PointerEvent) {
    const box = svgRef.current!.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    let best = 0;
    history.forEach((h, i) => {
      if (Math.abs(x(h.date) - px) < Math.abs(x(history[best].date) - px)) best = i;
    });
    setHover(best);
  }

  // Keep the two end labels from overlapping.
  let demY = y(last.p_dem_control);
  let repY = y(last.p_rep_control);
  if (Math.abs(demY - repY) < 16) {
    const mid = (demY + repY) / 2;
    const up = demY < repY ? -8 : 8;
    demY = mid + up;
    repY = mid - up;
  }

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
        aria-label={`Chance of Senate control by day. Latest: Democrats ${Math.round(last.p_dem_control * 100)}%, Republicans ${Math.round(last.p_rep_control * 100)}%.`}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((p) => (
          <g key={p}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(p)}
              y2={y(p)}
              stroke="var(--line)"
              strokeDasharray={p === 0.5 ? "4 4" : undefined}
            />
            <text x={PAD.left - 8} y={y(p) + 4} textAnchor="end" className="fill-muted text-[11px] tabular-nums">
              {p * 100}%
            </text>
          </g>
        ))}
        {ticks.map((t) => (
          <text key={t.iso} x={x(t.iso)} y={H - 8} textAnchor="middle" className="fill-muted text-[11px]">
            {t.label}
          </text>
        ))}
        <line x1={x(electionDay)} x2={x(electionDay)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--line)" />
        <text x={x(electionDay) + 4} y={PAD.top + 10} className="fill-muted text-[11px]">
          Nov 3
        </text>

        <path d={line("p_rep_control")} fill="none" stroke={REP} strokeWidth={2} strokeLinejoin="round" />
        <path d={line("p_dem_control")} fill="none" stroke={DEM} strokeWidth={2} strokeLinejoin="round" />
        {history.length === 1 && (
          <>
            <circle cx={x(last.date)} cy={y(last.p_rep_control)} r={4} fill={REP} />
            <circle cx={x(last.date)} cy={y(last.p_dem_control)} r={4} fill={DEM} />
          </>
        )}
        <text x={x(last.date) + 8} y={demY + 4} className="fill-foreground text-[12px] tabular-nums">
          Dem {Math.round(last.p_dem_control * 100)}%
        </text>
        <text x={x(last.date) + 8} y={repY + 4} className="fill-foreground text-[12px] tabular-nums">
          Rep {Math.round(last.p_rep_control * 100)}%
        </text>

        {point && (
          <g pointerEvents="none">
            <line x1={x(point.date)} x2={x(point.date)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--muted)" />
            <circle cx={x(point.date)} cy={y(point.p_dem_control)} r={4} fill={DEM} stroke="var(--background)" strokeWidth={2} />
            <circle cx={x(point.date)} cy={y(point.p_rep_control)} r={4} fill={REP} stroke="var(--background)" strokeWidth={2} />
          </g>
        )}
      </svg>
      {point && (
        <div
          className="pointer-events-none absolute top-0 rounded border border-line bg-background/95 px-3 py-2 text-xs tabular-nums shadow-lg"
          style={{
            left: `${(x(point.date) / W) * 100}%`,
            transform: x(point.date) > W / 2 ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
          }}
        >
          <p className="mb-1 text-muted">{formatDay(point.date)}</p>
          <p className="flex items-center gap-2">
            <span className="inline-block h-0.5 w-3" style={{ background: DEM }} />
            Democrats {Math.round(point.p_dem_control * 100)}%
          </p>
          <p className="flex items-center gap-2">
            <span className="inline-block h-0.5 w-3" style={{ background: REP }} />
            Republicans {Math.round(point.p_rep_control * 100)}%
          </p>
          <p className="mt-1 text-muted">{point.dem_seats_mean.toFixed(1)} Dem seats on average</p>
        </div>
      )}
    </div>
  );
}

function monthTicks(fromIso: string, toIso: string) {
  const ticks = [];
  const d = new Date(`${fromIso}T00:00:00Z`);
  if (d.getUTCDate() !== 1) {
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  while (d.toISOString().slice(0, 10) < toIso) {
    const iso = d.toISOString().slice(0, 10);
    ticks.push({ iso, label: formatDay(iso, { month: "short", day: "numeric" }) });
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return ticks;
}
