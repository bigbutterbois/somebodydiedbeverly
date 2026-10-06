import type { Country } from "@/lib/plates";
import { contentClient } from "./content";

// Every country on the plate checklist, alphabetical.
export async function getCountries(): Promise<Country[]> {
  const supabase = await contentClient();
  const { data, error } = await supabase
    .from("countries")
    .select("id, name, slug, plate_codes")
    .order("name");
  if (error) throw error;
  return data;
}
