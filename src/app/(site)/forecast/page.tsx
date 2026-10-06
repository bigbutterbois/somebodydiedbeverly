import {
  DEM,
  RATINGS,
  REP,
  formatDay,
  formatMargin,
  formatUpdated,
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

  // Rows (from the most Democratic-favored) Democrats must sweep to reach 51 seats; the
  // last of them is the race that decides control, the one before it a 50-50 Senate.
  const needed = 51 - (forecast.dem_seats_not_up ?? 34);
  const races = [...forecast.races].sort((a, b) => b.p_opp - a.p_opp || b.mean_margin - a.mean_margin);
  const independents = races.filter((r) => r.opp.party === "I").map((r) => r.name).sort();
  const daysLeft = Math.round((Date.parse(forecast.election_day) - Date.parse(forecast.as_of)) / 86_400_000);

  return (
    <div className="flex flex-col gap-14 py-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-4xl font-light tracking-tight">2026 Senate forecast</h1>
        <p className="text-sm text-muted">
          Updated{" "}
          {forecast.generated_at
            ? formatUpdated(forecast.generated_at)
            : formatDay(forecast.as_of, { weekday: "long", month: "long", day: "numeric" })}
          {daysLeft > 0 && ` · ${daysLeft} days to Election Day`}
        </p>
        <div className="flex flex-col gap-2 border-l-2 border-accent pl-3 text-sm text-muted">
          <p className="text-foreground">Patch notes, Oct. 6</p>
          <ul className="flex list-disc flex-col gap-1 pl-4">
            <li>
              <strong className="font-medium text-foreground">Trump approval:</strong> Fixed bug in data scraping to
              include more polls.
            </li>
            <li>
              <strong className="font-medium text-foreground">Super PAC spending:</strong> Outside spending by super
              PACs now counts toward each race&rsquo;s fundraising total in the fundamentals.
            </li>
            <li>
              <strong className="font-medium text-foreground">Polling weights (biggest change):</strong> Polls are now
              partially adjusted to account for historical errors. This shifted most polling averages in
              Republicans&rsquo; favor compared to previous model runs.
            </li>
          </ul>
        </div>
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
        <table className="w-full table-fixed text-[13px] tabular-nums sm:text-sm">
          <colgroup>
            <col className="w-[13%] sm:w-[16%]" />
            <col />
            <col />
            <col className="w-[15%] sm:w-[13%]" />
            <col className="w-[17%] sm:w-[13%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-line text-left text-[11px] uppercase tracking-[0.1em] text-muted sm:text-xs">
              <th className="py-2 pr-2 font-normal">State</th>
              <th className="py-2 pr-2 font-normal">Democrat</th>
              <th className="py-2 pr-2 font-normal">Republican</th>
              <th className="py-2 pr-2 text-right font-normal">Chance</th>
              <th className="py-2 text-right font-normal">Margin</th>
            </tr>
          </thead>
          <tbody>
            {races.map((r, i) => {
              const demFavored = r.p_opp >= 0.5;
              // The tipping-point race: whichever party wins it and every race on its side controls the Senate.
              const tipping = i === needed - 1;
              return (
                <tr key={r.state} className={`border-b border-line/60 align-top ${tipping ? "bg-accent/10" : ""}`}>
                  <td className={`relative py-2.5 pr-2 ${tipping ? "pl-2 shadow-[inset_2px_0_0_var(--accent)]" : ""}`}>
                    {tipping && (
                      <span className="absolute -top-2 left-2 rounded-sm bg-accent px-1.5 text-[9px] leading-4 font-medium tracking-wider whitespace-nowrap text-background uppercase">
                        Tipping point
                      </span>
                    )}
                    {r.state}
                    {r.special && <span className="hidden text-muted sm:inline"> (special)</span>}
                  </td>
                  <td className="py-2.5 pr-2">
                    <CandidateName race={r} side="opp" />
                  </td>
                  <td className="py-2.5 pr-2">
                    <CandidateName race={r} side="rep" />
                  </td>
                  <td className="py-2.5 pr-2 text-right" style={{ color: demFavored ? DEM : REP }}>
                    {outOf100(demFavored ? r.p_opp : r.p_rep)}%
                  </td>
                  <td
                    className={`py-2.5 text-right ${
                      // On phones the tint runs through the page gutter to the right edge of the screen.
                      tipping ? "relative max-sm:after:absolute max-sm:after:inset-y-0 max-sm:after:left-full max-sm:after:w-6 max-sm:after:bg-accent/10" : ""
                    }`}
                    style={{ color: r.mean_margin >= 0 ? DEM : REP }}
                  >
                    {formatMargin(r.mean_margin, partyLetter(r.opp))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-xs text-muted">
          Chance is the favorite&rsquo;s chance of winning; margin is the projected vote margin. The tipping-point
          race: the party that wins it and every race on its side of the table controls the
          Senate. (I) = incumbent · * =
          independent
        </p>
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="border-b border-line pb-2 text-xs uppercase tracking-[0.12em] text-muted">{children}</h2>
  );
}
