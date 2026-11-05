import type { Metadata } from "next";
import { getForecast } from "@/lib/forecast";
import { getSiteText } from "@/lib/supabase/site-text";
import { ElectionHeader } from "../ElectionHeader";
import { ForecastTabs } from "./ForecastTabs";

export const metadata: Metadata = { title: "2026 Midterms" };

/** "Monday, Nov. 2 at 8:03 PM ET" */
function ranAt(iso: string) {
  const at = new Date(iso);
  const opts = { timeZone: "America/New_York" } as const;
  const weekday = at.toLocaleDateString("en-US", { ...opts, weekday: "long" });
  const month = at.toLocaleDateString("en-US", { ...opts, month: "short" });
  const day = at.toLocaleDateString("en-US", { ...opts, day: "numeric" });
  const time = at.toLocaleTimeString("en-US", { ...opts, hour: "numeric", minute: "2-digit" });
  return `${weekday}, ${month}${month === "May" ? "" : "."} ${day} at ${time} ET`;
}

// The pre-election forecast (locked after its final run on Nov 2) is the third
// tab of the election page. The old /forecast links redirect here (next.config.ts).
export default async function ForecastLayout({ children }: LayoutProps<"/election/forecast">) {
  const [t, forecast] = await Promise.all([getSiteText(), getForecast()]);
  const at = forecast?.generated_at;
  const note = at ? `${forecast.final ? "Final forecast ran" : "Forecast updated"} ${ranAt(at)}` : undefined;
  return (
    <div className="flex flex-col gap-8 py-6">
      <ElectionHeader demo={0} showUpdated={false} note={note} />
      <section className="flex flex-col">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-light tracking-tight">Forecast</h2>
          <ForecastTabs labels={[t("forecast.tab.both"), t("forecast.tab.senate"), t("forecast.tab.house")]} />
        </div>
        {children}
      </section>
    </div>
  );
}
