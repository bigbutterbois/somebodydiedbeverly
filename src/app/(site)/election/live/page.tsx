import type { Metadata } from "next";
import { getForecast } from "@/lib/forecast";
import { demoCounts } from "@/lib/election/demo";
import { buildSnapshot } from "@/lib/election/live";
import { getLatestSnapshot } from "@/lib/election/server";
import { MAP_HEIGHT, MAP_WIDTH, stateBorders, stateShapes } from "../forecast/shapes";
import { ElectionHeader } from "../ElectionHeader";
import { LiveBoard } from "../LiveBoard";

export const metadata: Metadata = { title: "2026 Midterms" };

// Live Senate results on election night. Before any snapshot exists (until the
// first refresh on Nov 3), shows the starting point straight from the forecast.
// ?demo=40 shows made-up results about 40% counted, to preview the page.
export default async function LiveResultsPage({ searchParams }: PageProps<"/election/live">) {
  const demo = Number((await searchParams).demo) || 0;
  let snapshot = demo ? null : await getLatestSnapshot();
  if (!snapshot) {
    const forecast = await getForecast();
    if (forecast) snapshot = buildSnapshot(forecast, demo ? demoCounts(forecast, demo) : {}, demo ? new Date("2026-11-04T03:00:00Z") : undefined);
  }

  return (
    <div className="flex flex-col gap-8 py-6">
      <ElectionHeader demo={demo} blog />
      {snapshot ? (
        <LiveBoard
          key={demo}
          demo={demo}
          initial={snapshot}
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
