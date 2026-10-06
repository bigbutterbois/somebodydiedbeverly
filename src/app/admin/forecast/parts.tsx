import { DEM, REP, isIncumbent, outOf100, type Forecast, type Race } from "@/lib/forecast";

// Pieces of the House forecast page (admin only; the public Senate page keeps its own).

/** The chance Democrats win both chambers, from simulations that run both together. */
export function BothChambers({ house, senate }: { house: Forecast; senate: Forecast | null }) {
  if (house.p_dem_both == null) return null;
  const odds = (p: number) => (
    <span className="tabular-nums" style={{ color: DEM }}>
      {outOf100(p)}
    </span>
  );
  return (
    <p className="text-sm text-muted">
      {senate && (
        <>
          Democrats win the Senate in {odds(senate.p_dem_control)} and the House in {odds(house.p_dem_control)} of 100
          simulations, and{" "}
        </>
      )}
      {senate ? "both" : "Democrats win both the Senate and the House"} in {odds(house.p_dem_both)}
      {senate ? "" : " of 100 simulations"}; the two forecasts share their national swing, so they rise and fall
      together.
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
