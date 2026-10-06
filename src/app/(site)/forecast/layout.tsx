import { getSiteText } from "@/lib/supabase/site-text";
import { ForecastTabs } from "./ForecastTabs";

export default async function ForecastLayout({ children }: LayoutProps<"/forecast">) {
  const t = await getSiteText();
  return (
    <div className="flex flex-col pt-2">
      <ForecastTabs labels={[t("forecast.tab.both"), t("forecast.tab.senate"), t("forecast.tab.house")]} />
      {children}
    </div>
  );
}
