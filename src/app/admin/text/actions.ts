"use server";

import { revalidatePath } from "next/cache";
import { SITE_TEXT, isTextKey } from "@/lib/site-text";
import { ownerClient } from "@/lib/supabase/owner";

// Saves new wording for one piece of the site. Saving the default wording
// (or resetting) removes the edit, so later changes to the default in code
// show up again.
export async function saveSiteText(key: string, value: string | null) {
  if (!isTextKey(key)) throw new Error("That text isn't editable.");
  const supabase = await ownerClient();
  const text = value?.trim() ?? null;

  const { error } =
    text === null || text === SITE_TEXT[key].default
      ? await supabase.from("site_text").delete().eq("key", key)
      : await supabase.from("site_text").upsert({ key, value: text });
  if (error) throw new Error("That text didn't save.");

  revalidatePath("/", "layout");
}
