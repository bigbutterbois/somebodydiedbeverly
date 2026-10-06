import { GALLERY_COLUMNS, type GalleryItem } from "@/lib/gallery";
import { contentClient } from "./content";

// Every gallery piece in the order Mike set.
export async function getGalleryItems(limit?: number): Promise<GalleryItem[]> {
  const supabase = await contentClient();
  let query = supabase
    .from("gallery_items")
    .select(GALLERY_COLUMNS)
    .order("display_order")
    .order("created_at", { ascending: false });
  if (limit) query = query.limit(limit);
  const { data, error } = await query.overrideTypes<GalleryItem[], { merge: false }>();
  if (error) throw error;
  return data;
}
