import {
  DEM,
  REP,
  formatDay,
  formatMargin,
  formatUpdated,
  RATINGS,
  getHistory,
  getHouseForecast,
  outOf100,
  partyLetter,
  ratingInfo,
} from "@/lib/forecast";
import { OddsChart } from "../OddsChart";
import { CandidateName, SectionTitle, Topline } from "../parts";
import { DotHistogram } from "./DotHistogram";
import { HouseMap } from "./HouseMap";
import { getSiteText } from "@/lib/supabase/site-text";

export const metadata = { title: "House forecast" };

export default async function HouseForecastPage() {
  const [forecast, t] = await Promise.all([getHouseForecast(), getSiteText()]);

  if (!forecast) {
    return (
      <div className="flex flex-col gap-2 py-6">
        <h1 className="text-4xl font-light tracking-tight">{t("forecast.house.title")}</h1>
        <p className="text-muted">{t("forecast.house.empty")}</p>
      </div>
    );
  }
  const history = await getHistory(forecast);
  const majority = forecast.majority ?? 218;
  const total = forecast.races.length;

  // Every district from the most Democratic-favored down: the one at the majority line
  // decides control. The table shows the districts that aren't Safe for either side.
  const ranked = [...forecast.races].sort((a, b) => b.p_opp - a.p_opp || b.mean_margin - a.mean_margin);
  const tipping = ranked[majority - 1]?.state;
  const shown = ranked.filter((r) => Math.abs(r.rating) < 3 || r.state === tipping);
  const safe = (side: 1 | -1) => ranked.filter((r) => r.rating === 3 * side && r.state !== tipping).length;
  const daysLeft = Math.round((Date.parse(forecast.election_day) - Date.parse(forecast.as_of)) / 86_400_000);

  return (
    <div className="flex flex-col gap-14 py-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-4xl font-light tracking-tight">{t("forecast.house.title")}</h1>
        <p className="text-sm text-muted">
          Updated{" "}
          {forecast.generated_at
            ? formatUpdated(forecast.generated_at)
            : formatDay(forecast.as_of, { weekday: "long", month: "long", day: "numeric" })}
          {daysLeft > 0 && ` · ${daysLeft} days to Election Day`}
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <Topline forecast={forecast}>
          {t("forecast.house.topline", { majority, total })}
        </Topline>
      </section>

      {forecast.dem_seat_distribution && (
        <section className="flex flex-col gap-4">
          <SectionTitle>{t("forecast.house.simulations")}</SectionTitle>
          <DotHistogram distribution={forecast.dem_seat_distribution} total={total} majority={majority} />
          <p className="text-xs text-muted">
            {t("forecast.house.seatsMean", { seats: forecast.dem_seats_mean.toFixed(0) })}
          </p>
        </section>
      )}

      <section className="flex flex-col gap-4">
        <SectionTitle>{t("forecast.map")}</SectionTitle>
        <HouseMap races={forecast.races} />
        <ul className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-muted">
          {RATINGS.map((r) => (
            <li key={r.value} className="flex items-center gap-1.5">
              <span className="inline-block size-3 rounded-sm" style={{ background: r.color }} />
              {r.label}
            </li>
          ))}
        </ul>
      </section>

      {history.length > 0 && (
        <section className="flex flex-col gap-4">
          <SectionTitle>{t("forecast.house.byDay")}</SectionTitle>
          <OddsChart history={history} electionDay={forecast.election_day} chamber="House" />
        </section>
      )}

      <section className="flex flex-col gap-4">
        <SectionTitle>{t("forecast.house.competitive")}</SectionTitle>
        <table className="w-full table-fixed text-[13px] tabular-nums sm:text-sm">
          <colgroup>
            <col className="w-[15%] sm:w-[12%]" />
            <col />
            <col />
            <col className="w-[15%] sm:w-[12%]" />
            <col className="w-[17%] sm:w-[12%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-line text-left text-[11px] uppercase tracking-[0.1em] text-muted sm:text-xs">
              <th className="py-2 pr-2 font-normal">District</th>
              <th className="py-2 pr-2 font-normal">Democrat</th>
              <th className="py-2 pr-2 font-normal">Republican</th>
              <th className="py-2 pr-2 text-right font-normal">Chance</th>
              <th className="py-2 text-right font-normal">Margin</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const demFavored = r.p_opp >= 0.5;
              const isTipping = r.state === tipping;
              return (
                <tr key={r.state} className={`border-b border-line/60 align-top ${isTipping ? "bg-accent/10" : ""}`}>
                  <td className={`relative py-2.5 pr-2 ${isTipping ? "pl-2 shadow-[inset_2px_0_0_var(--accent)]" : ""}`}>
                    {isTipping && (
                      <span className="absolute -top-2 left-2 rounded-sm bg-accent px-1.5 text-[9px] leading-4 font-medium tracking-wider whitespace-nowrap text-background uppercase">
                        Tipping point
                      </span>
                    )}
                    <span title={`${r.name} · ${ratingInfo(r.rating).label}`}>{r.state}</span>
                    {r.new_lines && <span className="text-muted">†</span>}
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
                      isTipping ? "relative max-sm:after:absolute max-sm:after:inset-y-0 max-sm:after:left-full max-sm:after:w-6 max-sm:after:bg-accent/10" : ""
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
          {t("forecast.house.tableNote", { shown: shown.length, safeD: safe(1), safeR: safe(-1) })}
        </p>
      </section>

    </div>
  );
}
