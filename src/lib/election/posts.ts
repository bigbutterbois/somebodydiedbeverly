import "server-only";
import { contentClient } from "@/lib/supabase/content";

export type ElectionPost = { id: number; body: string; created_at: string; author?: string };

// Every live blog post since the start of the night (Mike), newest first. Empty if the table can't be read, so
// the page still works without them.
export async function getElectionPosts(limit = 2000): Promise<ElectionPost[]> {
  try {
    const supabase = await contentClient();
    const { data } = await supabase
      .from("election_posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    return data ?? [];
  } catch {
    return [];
  }
}
