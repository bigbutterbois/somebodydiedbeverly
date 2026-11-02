import type { Metadata } from "next";
import { getForecast } from "@/lib/forecast";
import { demoCounts } from "@/lib/election/demo";
import { buildSnapshot } from "@/lib/election/live";
import { getControlHistory, getLatestSnapshot } from "@/lib/election/server";
import { getSiteText } from "@/lib/supabase/site-text";
import { MAP_HEIGHT, MAP_WIDTH, stateBorders, stateShapes } from "../forecast/shapes";
import { LiveBoard } from "./LiveBoard";

export const metadata: Metadata = { title: "Election night" };

// Live Senate results on election night. Before any snapshot exists (until the
// first refresh on Nov 3), shows the starting point straight from the forecast.
// ?demo=40 shows made-up results about 40% counted, to preview the page.
export default async function ElectionPage({ searchParams }: PageProps<"/election">) {
  const demo = Number((await searchParams).demo) || 0;
  const [t, saved, history] = await Promise.all([getSiteText(), demo ? null : getLatestSnapshot(), getControlHistory()]);
  let snapshot = saved;
  if (!snapshot) {
    const forecast = await getForecast();
    if (forecast) snapshot = buildSnapshot(forecast, demo ? demoCounts(forecast, demo) : {}, demo ? new Date("2026-11-04T03:00:00Z") : undefined);
  }

  return (
    <div className="flex flex-col gap-8 py-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-light tracking-tight">{t("election.title")}</h1>
        <p className="max-w-2xl text-sm text-muted">{t("election.intro")}</p>
      </header>
      {demo > 0 && <p className="text-sm text-danger">Demo: these results are made up, about {demo}% counted.</p>}
      {snapshot ? (
        <LiveBoard
          key={demo}
          demo={demo > 0}
          initial={snapshot}
          live={Boolean(saved) || demo > 0}
          history={demo ? [] : history}
          shapes={stateShapes}
          borders={stateBorders}
          width={MAP_WIDTH}
          height={MAP_HEIGHT}
        />
      ) : (
        <p className="text-muted">The forecast isn&apos;t available right now.</p>
      )}
    </div>
  );
}
