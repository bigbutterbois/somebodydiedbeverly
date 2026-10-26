import { formatDay, formatUpdated, getForecast, getHistory, pollDots, type InputCheck } from "@/lib/forecast";
import { PollingChart } from "@/app/(site)/forecast/OddsChart";
import { SectionTitle } from "@/app/(site)/forecast/parts";
import { latestForecastRun, rerunConfigured } from "@/lib/forecast-rerun";
import { RerunButton } from "./RerunButton";

export const metadata = { title: "Forecast" };

const STATUS: Record<InputCheck["status"], { label: string; className: string }> = {
  ok: { label: "Worked", className: "text-accent" },
  stale: { label: "Stale", className: "text-foreground" },
  failed: { label: "Failed", className: "text-danger" },
};

// The morning run's inputs at a glance, and the national polls behind the averages
// with each pollster named on hover (the public charts show the dots unnamed).
export default async function AdminForecastPage() {
  const [forecast, run] = await Promise.all([getForecast(true), latestForecastRun()]);
  if (!forecast) {
    return <p className="text-muted">Couldn&apos;t load the forecast.</p>;
  }
  const history = await getHistory(forecast);
  const inputs = forecast.inputs ?? [];

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-normal tracking-tight">Forecast</h1>
        <p className="text-sm text-muted">
          Run {forecast.generated_at ? formatUpdated(forecast.generated_at) : formatDay(forecast.as_of)}
        </p>
        <div className="mt-3 flex flex-col gap-2">
          <RerunButton disabled={!rerunConfigured()} />
          {!rerunConfigured() ? (
            <p className="text-xs text-muted">The rerun button needs FORECAST_RERUN_TOKEN set in Vercel.</p>
          ) : (
            run && (
              <p className="text-xs text-muted">
                Last rerun started {formatUpdated(run.created_at)}:{" "}
                <a href={run.html_url} className="underline hover:text-foreground">
                  {run.status === "completed" ? (run.conclusion ?? "done") : run.status.replace("_", " ")}
                </a>
              </p>
            )
          )}
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <SectionTitle>Inputs in this run</SectionTitle>
        {inputs.length === 0 ? (
          <p className="text-sm text-muted">This run predates the input check; it fills in after the next run.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-muted">
                <tr className="border-b border-line">
                  <th className="py-2 pr-4 font-normal">Input</th>
                  <th className="py-2 pr-4 font-normal">Status</th>
                  <th className="py-2 pr-4 font-normal">Latest data</th>
                  <th className="py-2 font-normal">Summary</th>
                </tr>
              </thead>
              <tbody>
                {inputs.map((input) => (
                  <tr key={input.name} className="border-b border-line align-top">
                    <td className="py-2 pr-4 whitespace-nowrap">{input.name}</td>
                    <td className="py-2 pr-4">
                      <span className={STATUS[input.status].className}>{STATUS[input.status].label}</span>
                      <p className="text-xs text-muted">{input.fetch}</p>
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap tabular-nums">
                      {input.latest ? formatDay(input.latest, { month: "short", day: "numeric" }) : "None"}
                    </td>
                    <td className="py-2 text-muted">{input.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {forecast.problems && forecast.problems.length > 0 && (
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-danger">
            {forecast.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
      </section>

      {history.some((h) => h.generic_ballot) && (
        <section className="flex flex-col gap-4">
          <SectionTitle>Generic ballot polls</SectionTitle>
          <PollingChart
            history={history}
            electionDay={forecast.election_day}
            kind="generic_ballot"
            polls={pollDots(forecast, "generic_ballot", true)}
          />
        </section>
      )}

      {history.some((h) => h.approval) && (
        <section className="flex flex-col gap-4">
          <SectionTitle>Trump approval polls</SectionTitle>
          <PollingChart
            history={history}
            electionDay={forecast.election_day}
            kind="approval"
            polls={pollDots(forecast, "approval", true)}
          />
        </section>
      )}
    </div>
  );
}
