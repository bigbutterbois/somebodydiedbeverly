"use server";

import { logVisit } from "@/lib/visits";

// Called by VisitTracker after each page view on the public side.
export async function recordView(path: string, referrer: string) {
  await logVisit("view", path, referrer);
}
