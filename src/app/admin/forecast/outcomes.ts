import { DEM, REP } from "@/lib/forecast";

/** The four ways control of Congress can split, in a fixed order. */
export const OUTCOMES = [
  { label: "Democrats win both chambers", short: "Both D", color: DEM },
  { label: "Democratic House, Republican Senate", short: "D House", color: "#a66fd1" },
  { label: "Republican House, Democratic Senate", short: "D Senate", color: "#a8a39a" },
  { label: "Republicans win both chambers", short: "Both R", color: REP },
];

/**
 * The four outcomes' chances, from each chamber's chance of Democratic control and the
 * chance of both (all from the same simulations). A Senate without a Democratic
 * majority counts as Republican.
 */
export function outcomeOdds(senate: number, house: number, both: number | null) {
  if (both == null) return null;
  return [both, house - both, senate - both, 1 - senate - house + both].map((p) => Math.max(0, p));
}
