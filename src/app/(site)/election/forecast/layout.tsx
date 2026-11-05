import type { Metadata } from "next";
import { getSiteText } from "@/lib/supabase/site-text";
import { ElectionHeader } from "../ElectionHeader";
import { ForecastTabs } from "./ForecastTabs";

export const metadata: Metadata = { title: "2026 Midterms" };

// The pre-election forecast (locked after its final run on Nov 2) is the third
// tab of the election page. The old /forecast links redirect here (next.config.ts).
export default async function ForecastLayout({ children }: LayoutProps<"/election/forecast">) {
  const t = await getSiteText();
  return (
    <div className="flex flex-col gap-8 py-6">
      <ElectionHeader demo={0} showUpdated={false} />
      <div className="flex flex-col">
        <ForecastTabs labels={[t("forecast.tab.both"), t("forecast.tab.senate"), t("forecast.tab.house")]} />
        {children}
      </div>
    </div>
  );
}
