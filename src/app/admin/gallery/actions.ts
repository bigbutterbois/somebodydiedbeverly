"use server";

import { revalidatePath } from "next/cache";
import { GALLERY_COLUMNS, type GalleryItem } from "@/lib/gallery";
import { ownerClient } from "@/lib/supabase/owner";

function revalidateGallery() {
  revalidatePath("/gallery", "layout");
  revalidatePath("/admin/gallery");
  revalidatePath("/");
}

// Records an image the browser already uploaded to storage. New pieces go to
// the top of the gallery.
export async function addGalleryItem(input: {
  title: string;
  image_path: string;
  width: number;
  height: number;
}): Promise<GalleryItem> {
  const supabase = await ownerClient();
  const { data: first } = await supabase
    .from("gallery_items")
    .select("display_order")
    .order("display_order")
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("gallery_items")
    .insert({ ...input, title: input.title.trim(), display_order: (first?.display_order ?? 1) - 1 })
    .select(GALLERY_COLUMNS)
    .single()
    .overrideTypes<GalleryItem, { merge: false }>();
  if (error) throw new Error("That piece didn't save.");

  revalidateGallery();
  return data;
}

export async function renameGalleryItem(id: string, title: string) {
  const supabase = await ownerClient();
  const { error } = await supabase.from("gallery_items").update({ title: title.trim() }).eq("id", id);
  if (error) throw new Error("That title didn't save.");
  revalidateGallery();
}

// Saves a new order: ids from first to last.
export async function reorderGallery(ids: string[]) {
  const supabase = await ownerClient();
  const results = await Promise.all(
    ids.map((id, index) => supabase.from("gallery_items").update({ display_order: index }).eq("id", id)),
  );
  if (results.some((r) => r.error)) throw new Error("The new order didn't save.");
  revalidateGallery();
}

export async function deleteGalleryItem(id: string) {
  const supabase = await ownerClient();
  const { data, error } = await supabase
    .from("gallery_items")
    .delete()
    .eq("id", id)
    .select("image_path")
    .single();
  if (error) throw new Error("That piece couldn't be deleted.");

  await supabase.storage.from("gallery").remove([data.image_path]);
  revalidateGallery();
}
