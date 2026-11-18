import { FULL, shiftColor } from "./color";
import type { loadSwing } from "./data";

type Data = NonNullable<Awaited<ReturnType<typeof loadSwing>>>;

// The homepage's still picture of the Blue tsunami map: the default view (shift
// from Harris 2024), drawn on the server with no hover or zoom.
export function SwingPreview({ data }: { data: Data }) {
  const full = FULL;
  const ticks = [-full, 0, full];
  const stops = Array.from({ length: 21 }, (_, i) => -full + (i * 2 * full) / 20);
  return (
    <div className="flex flex-col gap-2">
      <svg viewBox="0 0 975 610" className="h-auto w-full" role="img" aria-label="County swing to 2026 since Harris 2024">
        <path d={data.others} fill="var(--map-empty)" />
        {data.counties.map((c) => (
          <path
            key={c.fips}
            d={c.d}
            fill={shiftColor(c.shift)}
            stroke="var(--background)"
            strokeWidth={0.3}
          />
        ))}
        <path d={data.borders} fill="none" stroke="var(--background)" strokeWidth={1.2} />
      </svg>
      <div className="flex max-w-xs flex-col gap-1 text-xs text-muted tabular-nums">
        <div
          className="h-2.5 rounded-sm"
          style={{ background: `linear-gradient(to right, ${stops.map((v) => shiftColor(v)).join(", ")})` }}
        />
        <div className="flex justify-between">
          {ticks.map((t) => (
            <span key={t}>{t === 0 ? "No shift" : `${t > 0 ? "D" : "R"}+${Math.abs(t)}`}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
