"use client";

import { useState } from "react";
import { favoriteLine, formatMargin, partyLetter, ratingInfo, type Race } from "@/lib/forecast";

type Shape = { name: string; d: string; cx: number; cy: number };

// The US map, each state with a Senate race shaded by rating. Hovering (or
// tapping) a state shows who's favored and how often they win.
export function SenateMap({
  shapes,
  borders,
  races,
  width,
  height,
}: {
  shapes: Shape[];
  borders: string;
  races: Race[];
  width: number;
  height: number;
}) {
  const byName = new Map(races.map((r) => [r.name, r]));
  const [active, setActive] = useState<{ race: Race; x: number; y: number } | null>(null);

  function show(race: Race, e: React.PointerEvent | React.FocusEvent, shape: Shape) {
    const box = (e.currentTarget.ownerSVGElement ?? e.currentTarget).getBoundingClientRect();
    const scale = box.width / width;
    if ("clientX" in e) setActive({ race, x: e.clientX - box.left, y: e.clientY - box.top });
    else setActive({ race, x: shape.cx * scale, y: shape.cy * scale });
  }

  return (
    <div className="relative" onPointerLeave={() => setActive(null)}>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Map of 2026 Senate races by rating">
        {shapes.map((s) => {
          const race = byName.get(s.name);
          if (!race) return <path key={s.name} d={s.d} fill="var(--surface)" />;
          return (
            <path
              key={s.name}
              d={s.d}
              fill={ratingInfo(race.rating).color}
              tabIndex={0}
              aria-label={`${race.name}: ${favoriteLine(race)}`}
              className="cursor-pointer outline-none"
              onPointerMove={(e) => show(race, e, s)}
              onPointerDown={(e) => show(race, e, s)}
              onFocus={(e) => show(race, e, s)}
              onBlur={() => setActive(null)}
            />
          );
        })}
        <path d={borders} fill="none" stroke="var(--background)" strokeWidth={1} strokeLinejoin="round" pointerEvents="none" />
        {/* Re-draw the hovered state's outline above the borders. */}
        {active && (
          <path
            d={shapes.find((s) => s.name === active.race.name)?.d}
            fill="none"
            stroke="var(--foreground)"
            strokeWidth={2}
            pointerEvents="none"
          />
        )}
      </svg>
      {active && <Tooltip {...active} />}
    </div>
  );
}

function Tooltip({ race, x, y }: { race: Race; x: number; y: number }) {
  const rating = ratingInfo(race.rating);
  const opp = partyLetter(race.opp);
  return (
    <div
      className="pointer-events-none absolute z-10 w-64 -translate-x-1/2 rounded border border-line bg-background/95 p-3 text-sm shadow-lg"
      style={{ left: `clamp(8rem, ${x}px, calc(100% - 8rem))`, top: y + 16 }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium">
          {race.name}
          {race.special && <span className="text-muted"> (special)</span>}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <span className="inline-block size-2.5 rounded-sm" style={{ background: rating.color }} />
          {rating.label}
        </span>
      </div>
      <p className="mt-2">{favoriteLine(race)}</p>
      <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-xs text-muted tabular-nums">
        <dt>
          {race.opp.name} ({opp})
        </dt>
        <dd className="text-right">{Math.round(race.p_opp * 100)}%</dd>
        <dt>{race.rep.name} (R)</dt>
        <dd className="text-right">{Math.round(race.p_rep * 100)}%</dd>
        <dt>Forecast margin</dt>
        <dd className="text-right">{formatMargin(race.mean_margin, opp)}</dd>
        <dt>Polling average</dt>
        <dd className="text-right">
          {race.poll_avg === null ? "No polls" : formatMargin(race.poll_avg, opp)}
        </dd>
      </dl>
    </div>
  );
}
