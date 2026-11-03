import Link from "next/link";
import { notFound } from "next/navigation";
import { ELECTION } from "@/lib/election/config";
import { getCountRows, getLatestSnapshot, getRecentGains } from "@/lib/election/server";
import { getForecast } from "@/lib/forecast";
import { Controls } from "../Controls";
import { diffText, loadSheet, marginText } from "./sheet";

export const metadata = { title: "Election night: counties" };

// One race's county sheet: what each county should look like if the final
// forecast is right (expected) and if the state is dead even (break-even),
// against the live count. "vs" columns are in margin points; + means the
// opposition candidate is doing better than that benchmark.
export default async function CountySheetPage({ params }: PageProps<"/admin/election/[state]">) {
  const { state } = await params;
  const [data, snap, forecast] = await Promise.all([
    loadSheet(state.toUpperCase()),
    getLatestSnapshot().catch(() => null),
    getForecast(),
  ]);
  if (!data) notFound();
  const { race, sheet } = data;
  const countRow = (await getCountRows().catch(() => [])).find((r) => r.state === sheet.state);
  const recent = await getRecentGains(sheet.state, countRow).catch(() => ({ gains: new Map<string, number>(), total: 0 }));
  const maxGain = Math.max(0, ...recent.gains.values());
  const settings = ELECTION.states[sheet.state] ?? {};
  const live = snap?.races.find((r) => r.state === sheet.state);
  const o = race.opp.party === "D" ? "D" : race.opp.party;
  const oppLast = race.opp.name.split(" ").pop();
  const repLast = race.rep.name.split(" ").pop();
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const num = (x: number) => x.toLocaleString();
  // Shading: blue where the opposition runs ahead of the benchmark, red where
  // the Republican does, deeper the bigger the gap (full at 12 points).
  const heat = (d: number | null) =>
    d === null || Math.abs(d) < 0.5
      ? undefined
      : {
          backgroundColor: `rgba(${d > 0 ? "74,134,232" : "229,83,75"},${(0.1 + 0.55 * Math.min(1, Math.abs(d) / 12)).toFixed(2)})`,
        };

  // Teal behind counties that added votes in the last 15 minutes, deeper for
  // the ones that added the most.
  const gainHeat = (added: number, max: number) =>
    added > 0 && max > 0
      ? { backgroundColor: `color-mix(in srgb, var(--accent) ${Math.round(15 + 45 * (added / max))}%, transparent)` }
      : undefined;

  const facts: [string, string][] = [
    ["Final forecast", `${marginText(sheet.forecastMargin, o)} · ${o} win ${pct(race.p_opp)}`],
    ["2024 president", marginText(sheet.margin2024, o)],
    ["Forecast swing from 2024", diffText(sheet.forecastSwing)],
    ["Break-even swing", diffText(sheet.breakevenSwing)],
    ["Expected votes", num(sheet.expectedVotes)],
    ["Counted", pct(sheet.counted)],
    ["Forecast weight now", pct(sheet.forecastWeight)],
    ["Counted votes vs expected", diffText(sheet.vsExpected)],
    ["Counted votes vs break-even", diffText(sheet.vsBreakeven)],
    ["Model swing / early-vote lean", `${diffText(sheet.swing)} / ${diffText(sheet.earlyLean)}`],
    [
      "Live projection",
      live
        ? `${marginText(live.margin.mean, o)} (${marginText(live.margin.p5, o)} to ${marginText(live.margin.p95, o)}) · ${o} win ${pct(live.pOpp)}`
        : "no model run yet",
    ],
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <nav className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
          <Link href="/admin/election" className="text-muted underline">
            All states
          </Link>
          {(forecast?.races ?? [])
            .map((r) => r.state)
            .sort()
            .map((s) => (
              <Link
                key={s}
                href={`/admin/election/${s}`}
                className={s === sheet.state ? "font-medium text-accent" : "text-muted underline"}
              >
                {s}
              </Link>
            ))}
        </nav>
        <h1 className="text-3xl font-normal tracking-tight">
          {race.name}: {race.opp.name} ({o}) vs {race.rep.name} (R)
        </h1>
        <p className="text-sm text-muted">
          <a href={`/admin/election/${sheet.state}/csv`} className="underline">
            Download CSV
          </a>
        </p>
        <Controls />
        <p className="text-xs text-muted">
          Updates itself every 30 seconds. Last model run:{" "}
          {snap ? new Date(snap.at).toLocaleTimeString("en-US", { timeZone: "America/New_York" }) + " ET" : "none yet"}.
        </p>
      </header>

      <dl className="grid grid-cols-1 gap-x-8 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {facts.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 border-b border-line py-1">
            <dt className="text-muted">{k}</dt>
            <dd className="tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      {settings.rankedChoice && (
        <p className="text-sm text-muted">
          Ranked-choice race: these are first-choice votes. If nobody passes 50%, the instant runoff decides it later,
          so a first-round lead can still lose.
        </p>
      )}
      <p className={`text-sm ${recent.total ? "text-accent" : "text-muted"}`}>
        {recent.total
          ? `${num(recent.total)} votes added in the last 15 minutes, across ${recent.gains.size} ${recent.gains.size === 1 ? "county" : "counties"}. Shaded in the "Last 15 min" column.`
          : "No votes added in the last 15 minutes."}
      </p>
      {sheet.rows.length === 1 && (
        <p className="text-sm text-muted">This feed gives statewide totals only, so the sheet is one row.</p>
      )}
      {settings.earlyLean ? (
        <p className="text-sm text-muted">
          Early-vote lean setting: {diffText(settings.earlyLean)} (early counted votes expected to run that far from the
          final margin).
        </p>
      ) : null}
      {sheet.unmatched.length > 0 && (
        <p className="text-sm text-danger">Feed counties not matched: {sheet.unmatched.join(", ")}</p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full whitespace-nowrap text-right text-xs tabular-nums">
          <thead className="text-muted">
            <tr className="border-b border-line">
              <th className="py-1 pr-3 text-left font-normal" rowSpan={2}>
                County
              </th>
              <th className="py-1 pr-3 font-normal" rowSpan={2}>
                2024
              </th>
              <th className="py-1 pr-3 font-normal" rowSpan={2}>
                Exp. votes
              </th>
              <th className="border-l border-line py-1 pr-3 font-normal" colSpan={4}>
                Expected (forecast)
              </th>
              <th className="border-l border-line py-1 pr-3 font-normal" colSpan={3}>
                Break-even
              </th>
              <th className="border-l border-line py-1 pr-3 font-normal" colSpan={6}>
                Live
              </th>
              <th className="border-l border-line py-1 pr-3 font-normal" colSpan={3}>
                Performance
              </th>
            </tr>
            <tr className="border-b border-line">
              <th className="border-l border-line py-1 pr-3 font-normal">{oppLast}</th>
              <th className="py-1 pr-3 font-normal">{repLast}</th>
              <th className="py-1 pr-3 font-normal">Other</th>
              <th className="py-1 pr-3 font-normal">Margin</th>
              <th className="border-l border-line py-1 pr-3 font-normal">{oppLast}</th>
              <th className="py-1 pr-3 font-normal">{repLast}</th>
              <th className="py-1 pr-3 font-normal">Margin</th>
              <th className="border-l border-line py-1 pr-3 font-normal">{oppLast}</th>
              <th className="py-1 pr-3 font-normal">{repLast}</th>
              <th className="py-1 pr-3 font-normal">Other</th>
              <th className="py-1 pr-3 font-normal">Counted</th>
              <th className="py-1 pr-3 font-normal">Last 15 min</th>
              <th className="py-1 pr-3 font-normal">Margin</th>
              <th className="border-l border-line py-1 pr-3 font-normal">vs exp.</th>
              <th className="py-1 pr-3 font-normal">vs even</th>
              <th className="py-1 pr-3 font-normal">Proj. final</th>
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((r) => (
              <tr key={r.fips} className="border-b border-line">
                <td className="py-1 pr-3 text-left">{r.name}</td>
                <td className="py-1 pr-3">{marginText(r.margin2024, o)}</td>
                <td className="py-1 pr-3">{num(r.expectedVotes)}</td>
                <td className="border-l border-line py-1 pr-3">{r.expected.opp.toFixed(1)}%</td>
                <td className="py-1 pr-3">{r.expected.rep.toFixed(1)}%</td>
                <td className="py-1 pr-3">{r.expected.other.toFixed(1)}%</td>
                <td className="py-1 pr-3">{marginText(r.expected.margin, o)}</td>
                <td className="border-l border-line py-1 pr-3">{r.breakeven.opp.toFixed(1)}%</td>
                <td className="py-1 pr-3">{r.breakeven.rep.toFixed(1)}%</td>
                <td className="py-1 pr-3">{marginText(r.breakeven.margin, o)}</td>
                <td className="border-l border-line py-1 pr-3">{r.live.total ? num(r.live.opp) : "–"}</td>
                <td className="py-1 pr-3">{r.live.total ? num(r.live.rep) : "–"}</td>
                <td className="py-1 pr-3">{r.live.total ? num(r.live.other) : "–"}</td>
                <td className="py-1 pr-3">{r.live.total ? (r.live.complete ? "done" : pct(r.live.counted)) : "–"}</td>
                <td className="py-1 pr-3" style={gainHeat(recent.gains.get(r.name) ?? 0, maxGain)}>
                  {recent.gains.get(r.name) ? `+${num(recent.gains.get(r.name)!)}` : "–"}
                </td>
                <td className="py-1 pr-3">{marginText(r.live.margin, o)}</td>
                <td className="border-l border-line py-1 pr-3" style={heat(r.vsExpected)}>
                  {diffText(r.vsExpected)}
                </td>
                <td className="py-1 pr-3" style={heat(r.vsBreakeven)}>
                  {diffText(r.vsBreakeven)}
                </td>
                <td className="py-1 pr-3">{marginText(r.projected.margin, o)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
