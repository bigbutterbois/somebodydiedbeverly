import "server-only";
import { contentClient } from "@/lib/supabase/content";

export type ElectionPost = { id: number; body: string; created_at: string };

// The live blog's posts, newest first. Empty if the table can't be read, so
// the page still works without them.
export async function getElectionPosts(limit = 50): Promise<ElectionPost[]> {
  try {
    const supabase = await contentClient();
    const { data } = await supabase
      .from("election_posts")
      .select("id, body, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    return data ?? [];
  } catch {
    return [];
  }
}
