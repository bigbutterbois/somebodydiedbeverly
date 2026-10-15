import type { Metadata } from "next";
import { getStationCoords } from "@/lib/metro/wmata";
import { getSiteText } from "@/lib/supabase/site-text";
import { MetroMap } from "./MetroMap";

export const metadata: Metadata = { title: "Metro map" };

export default async function MetroMapPage() {
  const t = await getSiteText();
  // Without the WMATA key (or if WMATA is down) the diagram still draws; only "To scale" needs this.
  const coords = await getStationCoords().catch(() => null);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted">{t("metro.map.intro")}</p>
      <MetroMap coords={coords} />
    </div>
  );
}
