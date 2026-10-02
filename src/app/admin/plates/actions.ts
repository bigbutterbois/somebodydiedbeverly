"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ownerClient } from "@/lib/supabase/owner";

export type LogState = { saved?: string; error?: string; at?: number } | null;

function readSighting(formData: FormData) {
  return {
    country_id: String(formData.get("country_id") ?? ""),
    date_spotted: String(formData.get("date_spotted") ?? ""),
    note: String(formData.get("note") ?? "").trim() || null,
  };
}

function revalidatePlates() {
  revalidatePath("/plates", "layout");
  revalidatePath("/admin/plates", "layout");
  revalidatePath("/");
}

// The one-screen phone form. Stays on the page so the next plate can be
// logged right away.
export async function logSighting(_prev: LogState, formData: FormData): Promise<LogState> {
  const supabase = await ownerClient();
  const sighting = readSighting(formData);
  if (!sighting.country_id) return { error: "Pick a country first." };
  if (!sighting.date_spotted) return { error: "Pick a date." };

  const { data, error } = await supabase
    .from("plate_sightings")
    .insert(sighting)
    .select("countries(name)")
    .single()
    .overrideTypes<{ countries: { name: string } | null }, { merge: false }>();
  if (error) return { error: "That didn't save. Try again." };

  revalidatePlates();
  return { saved: data.countries?.name ?? "Sighting", at: Date.now() };
}

export async function updateSighting(id: string, _prev: LogState, formData: FormData): Promise<LogState> {
  const supabase = await ownerClient();
  const sighting = readSighting(formData);
  if (!sighting.country_id || !sighting.date_spotted) {
    return { error: "A sighting needs a country and a date." };
  }

  const { error } = await supabase.from("plate_sightings").update(sighting).eq("id", id);
  if (error) return { error: "That didn't save. Try again." };

  revalidatePlates();
  redirect("/admin/plates");
}

export async function deleteSighting(id: string) {
  const supabase = await ownerClient();
  const { error } = await supabase.from("plate_sightings").delete().eq("id", id);
  if (error) throw new Error("That sighting couldn't be deleted.");

  revalidatePlates();
  redirect("/admin/plates");
}
