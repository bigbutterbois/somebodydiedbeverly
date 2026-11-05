import type { Metadata } from "next";
import { ElectionHeader } from "./ElectionHeader";
import { loadSwing } from "./swing/data";
import { SwingMap } from "./swing/SwingMap";

export const metadata: Metadata = { title: "2026 Midterms" };

// The election page opens on the county swing map; live results are the
// second tab (/election/live). ?demo=70 previews with made-up counts.
export default async function ElectionPage({ searchParams }: PageProps<"/election">) {
  const demo = Number((await searchParams).demo) || 0;
  const data = await loadSwing(demo || undefined);
  return (
    <div className="flex flex-col gap-8 py-6">
      <ElectionHeader demo={demo} />
      {data ? (
        <SwingMap
          states={data.states}
          counties={data.counties}
          others={data.others}
          borders={data.borders}
          compare2020={data.has2020}
        />
      ) : (
        <p className="text-muted">The forecast isn&apos;t available right now.</p>
      )}
    </div>
  );
}
