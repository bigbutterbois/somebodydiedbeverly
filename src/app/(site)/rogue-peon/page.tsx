import type { Metadata } from "next";
import { RoguePeon } from "./RoguePeon";

export const metadata: Metadata = { title: "Rogue Peon" };

// ?dev=1 shows the test tools (seed replay, bot hands, every power, skip to round 7).
export default async function RoguePeonPage({ searchParams }: PageProps<"/rogue-peon">) {
  const { dev } = await searchParams;
  return (
    <div className="-mt-6 -mb-6 flex flex-1 flex-col">
      <RoguePeon dev={dev === "1"} />
    </div>
  );
}
