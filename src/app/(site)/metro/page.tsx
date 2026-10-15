import type { Metadata } from "next";
import { getStationCoords } from "@/lib/metro/wmata";
import { Arrivals } from "./Arrivals";

export const metadata: Metadata = { title: "Metro" };

export default async function MetroPage({ searchParams }: PageProps<"/metro">) {
  const { station } = await searchParams;
  // Station locations, for finding the one nearest you. Missing until the WMATA key is set.
  const coords = await getStationCoords().catch(() => null);
  return <Arrivals coords={coords} requested={typeof station === "string" ? station : null} />;
}
