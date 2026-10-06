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
import { CircleGrid } from "./CircleGrid";
import { OUTCOMES, outcomeOdds } from "./outcomes";
import { SectionTitle } from "./parts";
import { Notes } from "@/components/Notes";
import { getSiteText } from "@/lib/supabase/site-text";

export const metadata = { title: "Forecast" };

// Both chambers at a glance: each model's odds, the four ways control can split
// (the two models share their national swing, so these come from the same
// simulations), and the national polling averages both models lean on.
export default async function BothForecastPage() {
  const [senate, house, t] = await Promise.all([getForecast(), getHouseForecast(), getSiteText()]);
  if (!senate || !house) {
    return (
      <div className="flex flex-col gap-2 py-6">
        <h1 className="text-4xl font-light tracking-tight">{t("forecast.both.title")}</h1>
        <p className="text-muted">{t("forecast.both.empty")}</p>
      </div>
    );
  }
  const [senateHistory, houseHistory] = await Promise.all([getHistory(senate), getHistory(house)]);
  const today = outcomeOdds(senate.p_dem_control, house.p_dem_control, house.p_dem_both ?? null);
  const daysLeft = Math.round((Date.parse(house.election_day) - Date.parse(house.as_of)) / 86_400_000);

  return (
    <div className="flex flex-col gap-14 py-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-4xl font-light tracking-tight">{t("forecast.both.title")}</h1>
        <p className="text-sm text-muted">
          Updated{" "}
          {house.generated_at
            ? formatUpdated(house.generated_at)
            : formatDay(house.as_of, { weekday: "long", month: "long", day: "numeric" })}
          {daysLeft > 0 && ` · ${daysLeft} days to Election Day`}
        </p>
        <Notes
          text={t("forecast.patchNotes")}
          className="flex flex-col gap-2 border-l-2 border-accent pl-3 text-sm text-muted [&>p:first-child]:text-foreground"
        />
      </header>

      <section className="grid gap-6 sm:grid-cols-2">
        <Chamber
          name="Senate"
          href="/forecast/senate"
          details={t("forecast.both.details")}
          forecast={senate}
          seats={t("forecast.both.seats", { seats: senate.dem_seats_mean.toFixed(0), total: 100 })}
        />
        <Chamber
          name="House"
          href="/forecast/house"
          details={t("forecast.both.details")}
          forecast={house}
          seats={t("forecast.both.seats", { seats: house.dem_seats_mean.toFixed(0), total: house.races.length })}
        />
      </section>

      {today && (
        <section className="flex flex-col gap-4">
          <SectionTitle>{t("forecast.both.control")}</SectionTitle>
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
          <p className="text-xs text-muted">{t("forecast.both.controlNote")}</p>
        </section>
      )}

      {houseHistory.some((h) => h.p_dem_both != null) && (
        <section className="flex flex-col gap-4">
          <SectionTitle>{t("forecast.both.byDay")}</SectionTitle>
          <ControlChart senate={senateHistory} house={houseHistory} electionDay={house.election_day} />
        </section>
      )}

      {senateHistory.some((h) => h.generic_ballot) && (
        <section className="flex flex-col gap-4">
          <SectionTitle>{t("forecast.genericBallot")}</SectionTitle>
          <PollingChart history={senateHistory} electionDay={senate.election_day} kind="generic_ballot" />
        </section>
      )}

      {senateHistory.some((h) => h.approval) && (
        <section className="flex flex-col gap-4">
          <SectionTitle>{t("forecast.approval")}</SectionTitle>
          <PollingChart history={senateHistory} electionDay={senate.election_day} kind="approval" />
        </section>
      )}
    </div>
  );
}

function Chamber({
  name,
  href,
  details,
  forecast,
  seats,
}: {
  name: string;
  href: string;
  details: string;
  forecast: Forecast;
  seats: string;
}) {
  return (
    <Link href={href} className="group flex flex-col gap-3 rounded border border-line p-4 hover:border-accent">
      <span className="flex items-baseline justify-between text-xs uppercase tracking-[0.12em] text-muted">
        {name}
        <span className="normal-case tracking-normal group-hover:text-accent">{details}</span>
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
      <p className="text-sm text-muted">{seats}</p>
    </Link>
  );
}
