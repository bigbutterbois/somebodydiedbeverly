"use server";

import { revalidatePath } from "next/cache";
import { refresh } from "@/lib/election/server";
import { ownerClient } from "@/lib/supabase/owner";

export async function refreshNow(): Promise<{ ok: boolean; message: string }> {
  await ownerClient(); // owner only
  try {
    const result = await refresh({ force: true });
    revalidatePath("/admin/election");
    return { ok: result.ran, message: result.ran ? "Refreshed." : `Skipped: ${result.reason}.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

// Live blog posts on /election, shown as "WM Admin" with the time posted.
export async function addPost(_: unknown, form: FormData): Promise<{ ok: boolean; message: string }> {
  const supabase = await ownerClient();
  const body = String(form.get("body") ?? "").trim();
  if (!body) return { ok: false, message: "Write something first." };
  const { error } = await supabase.from("election_posts").insert({ body });
  if (error) return { ok: false, message: "That post didn't save." };
  revalidatePath("/admin/election");
  revalidatePath("/election");
  return { ok: true, message: "Posted." };
}

export async function deletePost(id: number) {
  const supabase = await ownerClient();
  const { error } = await supabase.from("election_posts").delete().eq("id", id);
  if (error) throw new Error("That post didn't delete.");
  revalidatePath("/admin/election");
  revalidatePath("/election");
}

export async function editPost(id: number, body: string): Promise<{ ok: boolean; message: string }> {
  const supabase = await ownerClient();
  const text = body.trim();
  if (!text) return { ok: false, message: "A post can't be empty. Delete it instead." };
  const { error } = await supabase.from("election_posts").update({ body: text }).eq("id", id);
  if (error) return { ok: false, message: "That edit didn't save." };
  revalidatePath("/admin/election");
  revalidatePath("/election");
  return { ok: true, message: "Saved." };
}
