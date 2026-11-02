import { after } from "next/server";
import { getLatestSnapshot, inWindow, refresh } from "@/lib/election/server";

// The newest election night snapshot, for the page's once-a-minute update.
// If the cron job has stopped (the snapshot is over two minutes old), this
// starts a refresh after answering, so anyone watching keeps it going.
export const maxDuration = 60;

export async function GET() {
  const snapshot = await getLatestSnapshot();
  const stale = !snapshot || Date.now() - Date.parse(snapshot.at) > 120_000;
  if (stale && inWindow()) after(() => refresh().catch(() => {}));
  return Response.json(snapshot, { headers: { "Cache-Control": "no-store" } });
}
