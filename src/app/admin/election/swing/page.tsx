import { ElectionTabs } from "../ElectionTabs";
import { loadSwing } from "./data";
import { SwingMap } from "./SwingMap";

export const metadata = { title: "Swing map" };

function clock(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
}

export default async function SwingPage({ searchParams }: PageProps<"/admin/election/swing">) {
  const demo = Number((await searchParams).demo) || undefined;
  const data = await loadSwing(demo);
  return (
    <div className="flex flex-col gap-6">
      <ElectionTabs active="swing" />
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-normal tracking-tight">Swing map</h1>
        <p className="text-sm text-muted">
          Each county shaded by how much the Democrat&apos;s (or independent&apos;s) 2026 margin moved from Harris&apos;s
          2024 margin, using the votes counted so far.
          {data?.at && ` Counts last moved ${clock(data.at)} ET.`}
          {demo && " Showing made-up demo results."}
        </p>
      </header>
      {data ? (
        <SwingMap states={data.states} counties={data.counties} others={data.others} borders={data.borders} />
      ) : (
        <p className="text-sm text-muted">No forecast loaded yet.</p>
      )}
    </div>
  );
}
