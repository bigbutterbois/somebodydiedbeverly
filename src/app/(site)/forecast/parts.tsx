import Link from "next/link";
import { DEM, REP, isIncumbent, outOf100, type Forecast, type Race } from "@/lib/forecast";

// Pieces shared by the Senate and House forecast pages.

/** Senate / House switch at the top of both forecast pages. */
export function ChamberTabs({ active }: { active: "senate" | "house" }) {
  const tabs = [
    { key: "senate", href: "/forecast", label: "Senate" },
    { key: "house", href: "/forecast/house", label: "House" },
  ] as const;
  return (
    <nav className="flex gap-1 text-sm" aria-label="Chamber">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === active ? "page" : undefined}
          className={`rounded-full border px-3 py-1 transition-colors ${
            t.key === active ? "border-accent bg-accent text-background" : "border-line text-muted hover:text-foreground"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

/** The chance Democrats win both chambers, from simulations that run both together. */
export function BothChambers({ forecast }: { forecast: Forecast }) {
  if (forecast.p_dem_both == null) return null;
  return (
    <p className="text-sm text-muted">
      Democrats win both the Senate and the House in{" "}
      <span className="tabular-nums" style={{ color: DEM }}>
        {outOf100(forecast.p_dem_both)}
      </span>{" "}
      of 100 simulations; the two forecasts share their national swing, so they rise and fall together.
    </p>
  );
}

export function CandidateName({ race, side }: { race: Race; side: "rep" | "opp" }) {
  const c = race[side];
  // First initial only, to keep the table narrow on phones: "Susan Collins" → "S. Collins".
  const [first, ...rest] = c.name.split(" ");
  return (
    <>
      {rest.length ? `${first[0]}. ${rest.join(" ")}` : c.name}
      {c.party === "I" && "*"}
      {isIncumbent(race, side) && <span className="text-muted"> (I)</span>}
    </>
  );
}

export function Topline({ forecast, children }: { forecast: Forecast; children: React.ReactNode }) {
  const dem = Math.round(forecast.p_dem_control * 100);
  const rep = Math.round(forecast.p_rep_control * 100);
  const neither = forecast.p_no_majority >= 0.005;
  return (
    <section className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-6">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-[0.12em] text-muted">Democrats</span>
          <span className="text-5xl font-light tabular-nums" style={{ color: DEM }}>
            {dem}%
          </span>
        </div>
        <div className="flex flex-col items-end gap-1 text-right">
          <span className="text-xs uppercase tracking-[0.12em] text-muted">Republicans</span>
          <span className="text-5xl font-light tabular-nums" style={{ color: REP }}>
            {rep}%
          </span>
        </div>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-surface" aria-hidden>
        <div style={{ width: `${forecast.p_dem_control * 100}%`, background: DEM }} />
        <div className="flex-1" />
        <div style={{ width: `${forecast.p_rep_control * 100}%`, background: REP }} />
      </div>
      <p className="text-sm text-muted">
        {children}
        {neither &&
          ` In ${Math.round(forecast.p_no_majority * 100)}% of simulations neither side reaches a majority without an independent.`}
      </p>
    </section>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="border-b border-line pb-2 text-xs uppercase tracking-[0.12em] text-muted">{children}</h2>
  );
}
