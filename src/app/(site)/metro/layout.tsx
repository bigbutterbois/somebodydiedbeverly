import { getSiteText } from "@/lib/supabase/site-text";
import { MetroTabs } from "./MetroTabs";

export default async function MetroLayout({ children }: LayoutProps<"/metro">) {
  const t = await getSiteText();
  return (
    <div className="flex flex-col gap-5 pt-2">
      <MetroTabs labels={[t("metro.tab.arrivals"), t("metro.tab.map")]} />
      {children}
    </div>
  );
}
