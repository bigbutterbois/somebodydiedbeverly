import {
  DEM,
  RATINGS,
  REP,
  formatDay,
  formatMargin,
  getForecast,
  getHistory,
  isIncumbent,
  outOf100,
  partyLetter,
  type Forecast,
  type Race,
} from "@/lib/forecast";
import { OddsChart, PollingChart } from "./OddsChart";
import { SeatHistogram } from "./SeatHistogram";
import { SenateMap } from "./SenateMap";
import { MAP_HEIGHT, MAP_WIDTH, stateBorders, stateShapes } from "./shapes";

export const metadata = { title: "Senate forecast" };

export default async function ForecastPage() {
  const [forecast, history] = await Promise.all([getForecast(), getHistory()]);

  if (!forecast) {
    return (
      <div className="flex flex-col gap-2 py-6">
        <h1 className="text-4xl font-light tracking-tight">2026 Senate forecast</h1>
        <p className="text-muted">The first forecast is on its way. It updates every morning at 6am Eastern.</p>
      </div>
    );
  }

  const races = [...forecast.races].sort((a, b) => b.p_opp - a.p_opp || b.mean_margin - a.mean_margin);
  const independents = races.filter((r) => r.opp.party === "I").map((r) => r.name).sort();
  const daysLeft = Math.round((Date.parse(forecast.election_day) - Date.parse(forecast.as_of)) / 86_400_000);

  return (
    <div className="flex flex-col gap-14 py-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-4xl font-light tracking-tight">2026 Senate forecast</h1>
        <p className="text-sm text-muted">
          Updated {formatDay(forecast.as_of, { weekday: "long", month: "long", day: "numeric" })}
          {daysLeft > 0 && ` · ${daysLeft} days to Election Day`}
        </p>
      </header>

      <Topline forecast={forecast} />

      {forecast.dem_seat_distribution && (
        <section className="flex flex-col gap-4">
          <SectionTitle>Democratic seats in 100 simulations</SectionTitle>
          <p className="-mt-2 text-xs text-muted">Hover over or tap a dot to see that simulation&rsquo;s map.</p>
          <SeatHistogram
            distribution={forecast.dem_seat_distribution}
            samples={forecast.sample_simulations}
            raceNames={forecast.races.map((r) => r.name)}
            shapes={stateShapes}
            borders={stateBorders}
          />
        </section>
      )}

      <section className="flex flex-col gap-4">
        <SectionTitle>The map</SectionTitle>
        <SenateMap
          shapes={stateShapes}
          borders={stateBorders}
          races={forecast.races}
          width={MAP_WIDTH}
          height={MAP_HEIGHT}
        />
        <ul className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-muted">
          {RATINGS.map((r) => (
            <li key={r.value} className="flex items-center gap-1.5">
              <span className="inline-block size-3 rounded-sm" style={{ background: r.color }} />
              {r.label}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span className="inline-block size-3 rounded-sm bg-line" />
            No race
          </li>
        </ul>
        {independents.length > 0 && (
          <p className="text-center text-xs text-muted">
            Independents running as the main challenger ({independents.join(", ")}) count toward Democratic control.
          </p>
        )}
      </section>

      {history.length > 0 && (
        <section className="flex flex-col gap-4">
          <SectionTitle>Chance of controlling the Senate, by day</SectionTitle>
          <OddsChart history={history} electionDay={forecast.election_day} />
        </section>
      )}

      <section className="flex flex-col gap-4">
        <div className="-mx-6 overflow-x-auto px-6">
          <table className="w-full min-w-[22rem] text-sm tabular-nums">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-[0.12em] text-muted">
                <th className="py-2 pr-3 font-normal">State</th>
                <th className="py-2 pr-3 font-normal">Democrat</th>
                <th className="py-2 pr-3 font-normal">Republican</th>
                <th className="py-2 pr-3 font-normal">Win chance</th>
                <th className="hidden py-2 font-normal md:table-cell">Forecast</th>
              </tr>
            </thead>
            <tbody>
              {races.map((r) => (
                <tr key={r.state} className="border-b border-line/60">
                  <td className="py-2.5 pr-3">
                    {r.state}
                    {r.special && <span className="text-muted"> (special)</span>}
                  </td>
                  <td className="py-2.5 pr-3">
                    <CandidateName race={r} side="opp" />
                  </td>
                  <td className="py-2.5 pr-3">
                    <CandidateName race={r} side="rep" />
                  </td>
                  <td className="py-2.5 pr-3">
                    <ChanceBar pOpp={r.p_opp} />
                  </td>
                  <td className="hidden py-2.5 md:table-cell">{formatMargin(r.mean_margin, partyLetter(r.opp))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted">(I) = incumbent · * = independent</p>
      </section>

      {history.some((h) => h.generic_ballot) && (
        <section className="flex flex-col gap-4">
          <SectionTitle>Generic ballot polling average</SectionTitle>
          <PollingChart history={history} electionDay={forecast.election_day} kind="generic_ballot" />
        </section>
      )}

      {history.some((h) => h.approval) && (
        <section className="flex flex-col gap-4">
          <SectionTitle>Trump approval polling average</SectionTitle>
          <PollingChart history={history} electionDay={forecast.election_day} kind="approval" />
        </section>
      )}
    </div>
  );
}

function CandidateName({ race, side }: { race: Race; side: "rep" | "opp" }) {
  const c = race[side];
  return (
    <>
      {c.name}
      {c.party === "I" && "*"}
      {isIncumbent(race, side) && <span className="text-muted"> (I)</span>}
    </>
  );
}

function Topline({ forecast }: { forecast: Forecast }) {
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
        Democrats need 51 seats, since Vice President Vance breaks a 50–50 tie.
        {neither &&
          ` In ${Math.round(forecast.p_no_majority * 100)}% of simulations neither side reaches a majority without an independent.`}
      </p>
    </section>
  );
}

function ChanceBar({ pOpp }: { pOpp: number }) {
  return (
    <span className="flex items-center gap-2">
      <span className="w-9 text-right">{outOf100(pOpp)}%</span>
      <span className="flex h-1.5 w-20 overflow-hidden rounded-full" aria-hidden>
        <span style={{ width: `${pOpp * 100}%`, background: DEM }} />
        <span className="flex-1" style={{ background: REP }} />
      </span>
      <span className="w-9 text-muted">{outOf100(1 - pOpp)}%</span>
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="border-b border-line pb-2 text-xs uppercase tracking-[0.12em] text-muted">{children}</h2>
  );
}
