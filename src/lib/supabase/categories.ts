import type { Category } from "@/lib/blog";
import { createClient } from "./server";

// Every blog category, alphabetical.
export async function getCategories(): Promise<Category[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("categories").select("id, name, slug").order("name");
  if (error) throw error;
  return data;
}
