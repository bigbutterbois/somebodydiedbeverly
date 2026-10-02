import {
  DEM,
  RATINGS,
  REP,
  formatDay,
  formatMargin,
  getForecast,
  getHistory,
  outOf100,
  partyLetter,
  ratingInfo,
  type Forecast,
} from "@/lib/forecast";
import { OddsChart } from "./OddsChart";
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
  const daysLeft = Math.round((Date.parse(forecast.election_day) - Date.parse(forecast.as_of)) / 86_400_000);

  return (
    <div className="flex flex-col gap-14 py-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-4xl font-light tracking-tight">2026 Senate forecast</h1>
        <p className="text-sm text-muted">
          Updated {formatDay(forecast.as_of, { weekday: "long", month: "long", day: "numeric" })}
          {daysLeft > 0 && ` · ${daysLeft} days to Election Day`}
          {` · ${forecast.simulations.toLocaleString()} simulations each morning`}
        </p>
      </header>

      <Topline forecast={forecast} />

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
            <span className="inline-block size-3 rounded-sm border border-line bg-surface" />
            No race
          </li>
        </ul>
        <p className="text-center text-xs text-muted">
          Blue covers independents running as the main challenger (Nebraska, Idaho, Montana).
        </p>
      </section>

      {history.length > 0 && (
        <section className="flex flex-col gap-4">
          <SectionTitle>Chance of controlling the Senate, by day</SectionTitle>
          <OddsChart history={history} electionDay={forecast.election_day} />
        </section>
      )}

      <section className="flex flex-col gap-4">
        <SectionTitle>Every race</SectionTitle>
        <div className="-mx-6 overflow-x-auto px-6">
          <table className="w-full min-w-[34rem] text-sm tabular-nums">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-[0.12em] text-muted">
                <th className="py-2 pr-3 font-normal">State</th>
                <th className="py-2 pr-3 font-normal">Democrat / challenger</th>
                <th className="py-2 pr-3 font-normal">Republican</th>
                <th className="py-2 pr-3 font-normal">Win chance</th>
                <th className="hidden py-2 pr-3 font-normal sm:table-cell">Polls</th>
                <th className="hidden py-2 pr-3 font-normal md:table-cell">Forecast</th>
                <th className="py-2 font-normal">Rating</th>
              </tr>
            </thead>
            <tbody>
              {races.map((r) => {
                const rating = ratingInfo(r.rating);
                const opp = partyLetter(r.opp);
                return (
                  <tr key={r.state} className="border-b border-line/60">
                    <td className="py-2.5 pr-3">
                      {r.name}
                      {r.special && <span className="text-muted"> (special)</span>}
                    </td>
                    <td className="py-2.5 pr-3">
                      {r.opp.name} <span className="text-muted">({opp})</span>
                    </td>
                    <td className="py-2.5 pr-3">
                      {r.rep.name} <span className="text-muted">(R)</span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <ChanceBar pOpp={r.p_opp} />
                    </td>
                    <td className="hidden py-2.5 pr-3 text-muted sm:table-cell">
                      {r.poll_avg === null ? "None" : formatMargin(r.poll_avg, opp)}
                      {r.n_polls > 0 && <span className="text-xs"> ({r.n_polls})</span>}
                    </td>
                    <td className="hidden py-2.5 pr-3 md:table-cell">{formatMargin(r.mean_margin, opp)}</td>
                    <td className="py-2.5">
                      <span className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className="inline-block size-2.5 rounded-sm" style={{ background: rating.color }} />
                        {rating.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted">
          Ranked from most to least Democratic-favored. Polls is the weighted polling average (number of polls in the last
          four months); Forecast blends it with fundamentals.
        </p>
      </section>
    </div>
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
          <span className="text-sm text-muted">win the Senate in {outOf100(forecast.p_dem_control)} of 100 simulations</span>
        </div>
        <div className="flex flex-col items-end gap-1 text-right">
          <span className="text-xs uppercase tracking-[0.12em] text-muted">Republicans</span>
          <span className="text-5xl font-light tabular-nums" style={{ color: REP }}>
            {rep}%
          </span>
          <span className="text-sm text-muted">keep it in {outOf100(forecast.p_rep_control)} of 100</span>
        </div>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-surface" aria-hidden>
        <div style={{ width: `${forecast.p_dem_control * 100}%`, background: DEM }} />
        <div className="flex-1" />
        <div style={{ width: `${forecast.p_rep_control * 100}%`, background: REP }} />
      </div>
      <p className="text-sm text-muted">
        Democrats average <span className="text-foreground tabular-nums">{forecast.dem_seats_mean.toFixed(1)}</span> seats
        (80% range {forecast.dem_seats_10}–{forecast.dem_seats_90}); they need 51, since Vice President Vance breaks a
        50–50 tie.
        {neither &&
          ` In ${Math.round(forecast.p_no_majority * 100)}% of simulations neither side reaches a majority without an independent.`}
      </p>
    </section>
  );
}

function ChanceBar({ pOpp }: { pOpp: number }) {
  const opp = Math.round(pOpp * 100);
  return (
    <span className="flex items-center gap-2">
      <span className="w-8 text-right">{opp}%</span>
      <span className="flex h-1.5 w-20 overflow-hidden rounded-full" aria-hidden>
        <span style={{ width: `${pOpp * 100}%`, background: DEM }} />
        <span className="flex-1" style={{ background: REP }} />
      </span>
      <span className="w-8 text-muted">{100 - opp}%</span>
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="border-b border-line pb-2 text-xs uppercase tracking-[0.12em] text-muted">{children}</h2>
  );
}
