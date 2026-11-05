import { DEM, REP } from "@/lib/forecast";

/** The four ways control of Congress can split, in a fixed order. */
export const OUTCOMES = [
  { label: "Dem Senate + Dem House", short: "Dem Senate + House", color: DEM },
  { label: "GOP Senate + Dem House", short: "GOP Senate + Dem House", color: "#a66fd1" },
  { label: "Dem Senate + GOP House", short: "Dem Senate + GOP House", color: "#a8a39a" },
  { label: "GOP Senate + GOP House", short: "GOP Senate + House", color: REP },
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

/** Splits 100 circles among the outcomes in proportion to their odds (largest remainder). */
export function circleCounts(odds: number[], total = 100) {
  const exact = odds.map((p) => p * total);
  const counts = exact.map(Math.floor);
  let left = total - counts.reduce((a, b) => a + b, 0);
  for (const i of exact.map((e, i) => i).sort((a, b) => exact[b] - counts[b] - (exact[a] - counts[a]))) {
    if (left-- <= 0) break;
    counts[i] += 1;
  }
  return counts;
}
