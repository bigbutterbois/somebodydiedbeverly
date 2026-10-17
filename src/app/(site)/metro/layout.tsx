import { getSiteText } from "@/lib/supabase/site-text";
import { MetroTabs } from "./MetroTabs";

export default async function MetroLayout({ children }: LayoutProps<"/metro">) {
  const t = await getSiteText();
  return (
    <div className="flex flex-1 flex-col gap-5 pt-2">
      <MetroTabs labels={[t("metro.tab.map"), t("metro.tab.arrivals")]} />
      {children}
    </div>
  );
}
