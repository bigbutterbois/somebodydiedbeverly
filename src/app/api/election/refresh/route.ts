import { refresh } from "@/lib/election/server";

// Called every minute on election night by a Supabase cron job (see the
// election_night migration). Open without the family password, since the
// job has no cookie; it can't do harm: a refresh runs at most once a minute,
// and after election night only when new counts have been published.
export const maxDuration = 60;

export async function GET() {
  try {
    return Response.json(await refresh());
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
