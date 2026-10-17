import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MetroMap } from "./MetroMap";

export const metadata: Metadata = { title: "Metro" };

export default async function MetroPage({ searchParams }: PageProps<"/metro">) {
  // Station links from before the map moved here were for arrivals.
  const { station } = await searchParams;
  if (typeof station === "string") redirect(`/metro/arrivals?station=${encodeURIComponent(station)}`);
  return (
    <div className="-mb-6 flex flex-1 flex-col">
      <MetroMap />
    </div>
  );
}
