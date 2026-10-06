import Link from "next/link";
import { PollingChart } from "@/app/(site)/forecast/OddsChart";
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
import { OUTCOMES, outcomeOdds } from "./outcomes";
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
      </header>

      <section className="grid gap-6 sm:grid-cols-2">
        <Chamber name="Senate" href="/admin/forecast/senate" forecast={senate} total={100} />
        <Chamber name="House" href="/admin/forecast/house" forecast={house} total={house.races.length} />
      </section>

      {today && (
        <section className="flex flex-col gap-4">
          <SectionTitle>Who controls Congress</SectionTitle>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded border border-line bg-line">
            {OUTCOMES.map((o, i) => (
              <div key={o.label} className="flex flex-col gap-1 bg-background p-4">
                <span className="text-3xl font-light tabular-nums" style={{ color: o.color }}>
                  {outOf100(today[i])}%
                </span>
                <span className="text-sm text-muted">{o.label}</span>
              </div>
            ))}
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
        Democrats win {forecast.dem_seats_mean.toFixed(0)} of {total} seats on average (8 in 10 simulations:{" "}
        {forecast.dem_seats_10}–{forecast.dem_seats_90}).
      </p>
    </Link>
  );
}
