"use client";

import { useEffect, useRef, useState } from "react";
import { formatDay } from "@/lib/forecast";

const PAD = { top: 16, right: 108, bottom: 40, left: 40 };

const dayNumber = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86_400_000;

export type TrendSeries = { label: string; short: string; color: string };
export type TrendPoint = { date: string; values: number[]; note?: string };

// A line chart by day, from the first point through election day. Used for the
// chance of control and for the generic ballot and approval averages.
export function TrendChart({
  points,
  series,
  electionDay,
  domain,
  yTicks,
  format,
  dashed,
  label,
}: {
  points: TrendPoint[];
  series: TrendSeries[];
  electionDay: string;
  domain: [number, number];
  yTicks: number[];
  format: (v: number) => string;
  dashed?: number;
  label: string;
}) {
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

  const start = dayNumber(points[0].date);
  const end = Math.max(dayNumber(electionDay), dayNumber(points[points.length - 1].date));
  const x = (iso: string) => PAD.left + ((dayNumber(iso) - start) / Math.max(end - start, 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - domain[0]) / (domain[1] - domain[0])) * (H - PAD.top - PAD.bottom);
  const line = (i: number) =>
    points.map((p, j) => `${j ? "L" : "M"}${x(p.date).toFixed(1)},${y(p.values[i]).toFixed(1)}`).join("");

  const last = points[points.length - 1];
  const point = hover === null ? null : points[hover];
  const ticks = weekTicks(points[0].date, electionDay, (W - PAD.left - PAD.right) / Math.max(end - start, 1));

  function onMove(e: React.PointerEvent) {
    const box = svgRef.current!.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(x(p.date) - px) < Math.abs(x(points[best].date) - px)) best = i;
    });
    setHover(best);
  }

  // Spread the end labels so they don't overlap.
  const ends = series
    .map((s, i) => ({ s, i, y: y(last.values[i]) }))
    .sort((a, b) => a.y - b.y);
  for (let k = 1; k < ends.length; k++) ends[k].y = Math.max(ends[k].y, ends[k - 1].y + 16);

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
        aria-label={`${label}. Latest: ${series.map((s, i) => `${s.label} ${format(last.values[i])}`).join(", ")}.`}
      >
        {yTicks.map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--line)"
              strokeDasharray={v === dashed ? "4 4" : undefined}
            />
            <text x={PAD.left - 8} y={y(v) + 4} textAnchor="end" className="fill-muted text-[11px] tabular-nums">
              {format(v)}
            </text>
          </g>
        ))}
        {ticks.map((t) => (
          <text key={t.iso} x={x(t.iso)} y={H - 22} textAnchor="middle" className="fill-muted text-[11px]">
            {t.label}
          </text>
        ))}
        <text x={x(electionDay)} y={H - 22} textAnchor="middle" className="fill-foreground text-[11px]">
          Election Day
        </text>
        <text x={x(electionDay)} y={H - 8} textAnchor="middle" className="fill-muted text-[11px]">
          ({formatDay(electionDay, { month: "short", day: "numeric" })})
        </text>
        <line x1={x(electionDay)} x2={x(electionDay)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--line)" />

        {series.map((s, i) => (
          <path key={s.label} d={line(i)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
        ))}
        {points.length === 1 &&
          series.map((s, i) => <circle key={s.label} cx={x(last.date)} cy={y(last.values[i])} r={4} fill={s.color} />)}
        {ends.map(({ s, i, y: ly }) => (
          <text key={s.label} x={x(last.date) + 8} y={ly + 4} className="fill-foreground text-[12px] tabular-nums">
            {s.short} {format(last.values[i])}
          </text>
        ))}

        {point && (
          <g pointerEvents="none">
            <line x1={x(point.date)} x2={x(point.date)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--muted)" />
            {series.map((s, i) => (
              <circle
                key={s.label}
                cx={x(point.date)}
                cy={y(point.values[i])}
                r={4}
                fill={s.color}
                stroke="var(--background)"
                strokeWidth={2}
              />
            ))}
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
          {series.map((s, i) => (
            <p key={s.label} className="flex items-center gap-2">
              <span className="inline-block h-0.5 w-3" style={{ background: s.color }} />
              {s.label} {format(point.values[i])}
            </p>
          ))}
          {point.note && <p className="mt-1 text-muted">{point.note}</p>}
        </div>
      )}
    </div>
  );
}

/** A date label every 7 days before election day, back to the first point; thinned on narrow screens. */
function weekTicks(fromIso: string, electionDay: string, pxPerDay: number) {
  const every = Math.max(1, Math.ceil(48 / (7 * pxPerDay)));
  const ticks = [];
  const d = new Date(`${electionDay}T00:00:00Z`);
  for (let i = 1; ; i++) {
    d.setUTCDate(d.getUTCDate() - 7);
    const iso = d.toISOString().slice(0, 10);
    if (iso < fromIso) break;
    if (i % every === 0) ticks.push({ iso, label: formatDay(iso, { month: "short", day: "numeric" }) });
  }
  return ticks;
}
