import type { Category } from "@/lib/blog";
import { contentClient } from "./content";

// Every blog category, alphabetical.
export async function getCategories(): Promise<Category[]> {
  const supabase = await contentClient();
  const { data, error } = await supabase.from("categories").select("id, name, slug").order("name");
  if (error) throw error;
  return data;
}
