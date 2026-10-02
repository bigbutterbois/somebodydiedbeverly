"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Category, PostStatus } from "@/lib/blog";
import { slugify } from "@/lib/slug";
import { ownerClient } from "@/lib/supabase/owner";

export type PostInput = {
  id?: string;
  title: string;
  slug: string;
  content: string;
  category_id: string | null;
  status: PostStatus;
  published_at: string | null;
};

export type SaveResult =
  | { ok: true; id: string; slug: string; published_at: string | null }
  | { ok: false; error: string };

function revalidateBlog() {
  revalidatePath("/blog", "layout");
  revalidatePath("/admin/blog", "layout");
  revalidatePath("/");
}

export async function savePost(input: PostInput): Promise<SaveResult> {
  const supabase = await ownerClient();
  const title = input.title.trim();
  const slug = slugify(input.slug || title);
  if (!title) return { ok: false, error: "Give the post a title." };
  if (!slug) return { ok: false, error: "The URL needs at least one letter or number." };

  const row = {
    title,
    slug,
    content: input.content,
    category_id: input.category_id || null,
    status: input.status,
    // Keeps the original date when a published post is edited or republished.
    published_at:
      input.status === "published" ? (input.published_at ?? new Date().toISOString()) : input.published_at,
  };

  const query = input.id
    ? supabase.from("posts").update(row).eq("id", input.id)
    : supabase.from("posts").insert(row);
  const { data, error } = await query.select("id, slug, published_at").single();

  if (error?.code === "23505") return { ok: false, error: "Another post already uses that URL." };
  if (error) return { ok: false, error: "That didn't save. Try again." };

  revalidateBlog();
  return { ok: true, ...data };
}

export async function deletePost(id: string) {
  const supabase = await ownerClient();
  const { error } = await supabase.from("posts").delete().eq("id", id);
  if (error) throw new Error("That post couldn't be deleted.");

  revalidateBlog();
  redirect("/admin/blog");
}

export async function createCategory(
  name: string,
): Promise<{ ok: true; category: Category } | { ok: false; error: string }> {
  const supabase = await ownerClient();
  const trimmed = name.trim();
  const slug = slugify(trimmed);
  if (!slug) return { ok: false, error: "Give the category a name." };

  const { data, error } = await supabase
    .from("categories")
    .insert({ name: trimmed, slug })
    .select("id, name, slug")
    .single();
  if (error?.code === "23505") return { ok: false, error: "That category already exists." };
  if (error) return { ok: false, error: "That category didn't save." };

  revalidateBlog();
  return { ok: true, category: data };
}
