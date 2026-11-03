import Link from "next/link";
import { getForecast } from "@/lib/forecast";
import { getSiteText } from "@/lib/supabase/site-text";
import { ForecastTabs } from "./ForecastTabs";

export default async function ForecastLayout({ children }: LayoutProps<"/forecast">) {
  const [t, forecast] = await Promise.all([getSiteText(), getForecast()]);
  return (
    <div className="flex flex-col pt-2">
      {forecast?.final && (
        <aside className="mb-4 flex flex-col gap-1 rounded border border-accent p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <p className="text-sm">{t("forecast.final.note")}</p>
          <Link href="/election" className="shrink-0 text-sm font-medium text-accent hover:underline">
            {t("forecast.final.link")}
          </Link>
        </aside>
      )}
      <ForecastTabs labels={[t("forecast.tab.both"), t("forecast.tab.senate"), t("forecast.tab.house")]} />
      {children}
    </div>
  );
}
