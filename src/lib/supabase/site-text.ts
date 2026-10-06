import "server-only";
import { cache } from "react";
import { SITE_TEXT, fillText, type TextKey } from "@/lib/site-text";
import { contentClient } from "./content";

// Mike's edits to the site's wording (see src/lib/site-text.ts), read once per
// request. Returns t(key, fills): his edit if he made one, else the default.
// If the table can't be read, every page still shows the default wording.
export const getSiteText = cache(async () => {
  const supabase = await contentClient();
  const { data } = await supabase.from("site_text").select("key, value");
  const edits = new Map<string, string>(data?.map((row) => [row.key, row.value]));
  return (key: TextKey, fills?: Record<string, string | number>) =>
    fillText(edits.get(key) ?? SITE_TEXT[key].default, fills);
});
