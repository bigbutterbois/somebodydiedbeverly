import type { Metadata } from "next";
import { getSiteText } from "@/lib/supabase/site-text";
import { MetroMap } from "./MetroMap";

export const metadata: Metadata = { title: "Metro map" };

export default async function MetroMapPage() {
  const t = await getSiteText();
  return (
    <div className="-mb-6 flex flex-1 flex-col gap-3">
      <p className="text-muted">{t("metro.map.intro")}</p>
      <MetroMap />
    </div>
  );
}
