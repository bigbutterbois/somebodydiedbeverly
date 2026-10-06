import Link from "next/link";
import { PollingChart } from "./OddsChart";
import {
  DEM,
  REP,
  formatDay,
  formatUpdated,
  getForecast,
  getHistory,
  getHouseForecast,
  outOf100,
  type Forecast,
} from "@/lib/forecast";
import { ControlChart } from "./ControlChart";
import { OUTCOMES, circleCounts, outcomeOdds } from "./outcomes";
import { SectionTitle } from "./parts";

export const metadata = { title: "Forecast" };

// Both chambers at a glance: each model's odds, the four ways control can split
// (the two models share their national swing, so these come from the same
// simulations), and the national polling averages both models lean on.
export default async function BothForecastPage() {
  const [senate, house] = await Promise.all([getForecast(), getHouseForecast()]);
  if (!senate || !house) {
    return (
      <div className="flex flex-col gap-2 py-6">
        <h1 className="text-4xl font-light tracking-tight">2026 midterms</h1>
        <p className="text-muted">The first House forecast is on its way. It updates every morning at 6am Eastern.</p>
      </div>
    );
  }
  const [senateHistory, houseHistory] = await Promise.all([getHistory(senate), getHistory(house)]);
  const today = outcomeOdds(senate.p_dem_control, house.p_dem_control, house.p_dem_both ?? null);
  const daysLeft = Math.round((Date.parse(house.election_day) - Date.parse(house.as_of)) / 86_400_000);

  return (
    <div className="flex flex-col gap-14 py-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-4xl font-light tracking-tight">2026 midterms</h1>
        <p className="text-sm text-muted">
          Updated{" "}
          {house.generated_at
            ? formatUpdated(house.generated_at)
            : formatDay(house.as_of, { weekday: "long", month: "long", day: "numeric" })}
          {daysLeft > 0 && ` · ${daysLeft} days to Election Day`}
        </p>
        <div className="flex flex-col gap-2 border-l-2 border-accent pl-3 text-sm text-muted">
          <p className="text-foreground">Introducing the 2026 Midterms House Election Forecast!</p>
          <p>And a few model updates&hellip;</p>
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
              <strong className="font-medium text-foreground">Polling weights (biggest model change):</strong> Polls
              are now partially adjusted to account for historical errors. This shifted most polling averages in
              Republicans&rsquo; favor compared to previous model runs.
            </li>
          </ul>
        </div>
      </header>

      <section className="grid gap-6 sm:grid-cols-2">
        <Chamber name="Senate" href="/forecast/senate" forecast={senate} total={100} />
        <Chamber name="House" href="/forecast/house" forecast={house} total={house.races.length} />
      </section>

      {today && (
        <section className="flex flex-col gap-4">
          <SectionTitle>Who controls Congress</SectionTitle>
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            <CircleGrid odds={today} />
            <ul className="flex w-full flex-col gap-3">
              {OUTCOMES.map((o, i) => (
                <li key={o.label} className="flex items-baseline gap-3 border-b border-line/60 pb-3">
                  <span className="inline-block size-3 shrink-0 rounded-full" style={{ background: o.color }} />
                  <span className="flex-1 text-sm">{o.label}</span>
                  <span className="text-2xl font-light tabular-nums" style={{ color: o.color }}>
                    {outOf100(today[i])}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-muted">
            Both forecasts run on the same simulated national swing, so a good night for Democrats in one chamber
            usually means a good night in the other.
          </p>
        </section>
      )}

      {houseHistory.some((h) => h.p_dem_both != null) && (
        <section className="flex flex-col gap-4">
          <SectionTitle>Control of Congress, by day</SectionTitle>
          <ControlChart senate={senateHistory} house={houseHistory} electionDay={house.election_day} />
        </section>
      )}

      {senateHistory.some((h) => h.generic_ballot) && (
        <section className="flex flex-col gap-4">
          <SectionTitle>Generic ballot polling average</SectionTitle>
          <PollingChart history={senateHistory} electionDay={senate.election_day} kind="generic_ballot" />
        </section>
      )}

      {senateHistory.some((h) => h.approval) && (
        <section className="flex flex-col gap-4">
          <SectionTitle>Trump approval polling average</SectionTitle>
          <PollingChart history={senateHistory} electionDay={senate.election_day} kind="approval" />
        </section>
      )}
    </div>
  );
}

function Chamber({ name, href, forecast, total }: { name: string; href: string; forecast: Forecast; total: number }) {
  return (
    <Link href={href} className="group flex flex-col gap-3 rounded border border-line p-4 hover:border-accent">
      <span className="flex items-baseline justify-between text-xs uppercase tracking-[0.12em] text-muted">
        {name}
        <span className="normal-case tracking-normal group-hover:text-accent">Details →</span>
      </span>
      <div className="flex items-baseline justify-between">
        <span className="text-4xl font-light tabular-nums" style={{ color: DEM }}>
          {Math.round(forecast.p_dem_control * 100)}%
        </span>
        <span className="text-4xl font-light tabular-nums" style={{ color: REP }}>
          {Math.round(forecast.p_rep_control * 100)}%
        </span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-surface" aria-hidden>
        <div style={{ width: `${forecast.p_dem_control * 100}%`, background: DEM }} />
        <div className="flex-1" />
        <div style={{ width: `${forecast.p_rep_control * 100}%`, background: REP }} />
      </div>
      <p className="text-sm text-muted">
        Democrats win {forecast.dem_seats_mean.toFixed(0)} of {total} seats on average.
      </p>
    </Link>
  );
}

/** 100 circles colored in proportion to each outcome's odds, read row by row. */
function CircleGrid({ odds }: { odds: number[] }) {
  const colors = circleCounts(odds).flatMap((n, i) => Array<string>(n).fill(OUTCOMES[i].color));
  return (
    <svg
      viewBox="0 0 100 100"
      className="w-56 shrink-0"
      role="img"
      aria-label={`100 simulations: ${OUTCOMES.map((o, i) => `${o.label} ${circleCounts(odds)[i]}`).join(", ")}`}
    >
      {colors.map((c, k) => (
        <circle key={k} cx={5 + (k % 10) * 10} cy={5 + Math.floor(k / 10) * 10} r={4.1} fill={c} />
      ))}
    </svg>
  );
}
