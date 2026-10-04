import { DEM, REP, seatDots, type Forecast } from "@/lib/forecast";

const W = 720;
const PAD = { top: 4, right: 4, bottom: 30, left: 4 };

// A static, server-rendered version of the forecast page's seat histogram for
// the homepage: the same 100 dots stacked by Democratic seats, no hover.
export function SeatHistogramPreview({ forecast }: { forecast: Forecast }) {
  const counts = new Map<number, number>();
  if (forecast.sample_simulations?.length) {
    for (const sim of forecast.sample_simulations) counts.set(sim.dem_seats, (counts.get(sim.dem_seats) ?? 0) + 1);
  } else {
    for (const [s, n] of seatDots(forecast.dem_seat_distribution)) counts.set(s, n);
  }
  const seats = [...counts.keys()];
  const lo = Math.min(...seats, 50) - 1;
  const hi = Math.max(...seats, 51) + 1;
  const cols = hi - lo + 1;
  const colW = (W - PAD.left - PAD.right) / cols;
  const r = Math.max(2.5, Math.min(7, colW / 2 - 1.5));
  const H = PAD.top + Math.max(...counts.values()) * (2 * r + 2) + PAD.bottom;
  const cx = (s: number) => PAD.left + (s - lo + 0.5) * colW;
  const base = H - PAD.bottom;
  const labelEvery = 2; // the SVG scales down on phones, so keep labels sparse and large

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Democratic seats in 100 simulations: ${seats
        .sort((a, b) => a - b)
        .map((s) => `${s} seats in ${counts.get(s)}`)
        .join(", ")}.`}
    >
      <line x1={cx(50.5)} x2={cx(50.5)} y1={PAD.top} y2={base + 6} stroke="var(--muted)" strokeDasharray="3 3" />
      <line x1={PAD.left} x2={W - PAD.right} y1={base + 0.5} y2={base + 0.5} stroke="var(--line)" />
      {seats.map((s) =>
        Array.from({ length: counts.get(s)! }, (_, k) => (
          <circle
            key={`${s}-${k}`}
            cx={cx(s)}
            cy={base - r - 1 - k * (2 * r + 2)}
            r={r}
            fill={s >= 51 ? DEM : REP}
          />
        )),
      )}
      {Array.from({ length: cols }, (_, i) => lo + i)
        .filter((s) => (s - 50) % labelEvery === 0)
        .map((s) => (
          <text key={s} x={cx(s)} y={base + 24} textAnchor="middle" className="fill-muted text-[18px] tabular-nums">
            {s}
          </text>
        ))}
    </svg>
  );
}
