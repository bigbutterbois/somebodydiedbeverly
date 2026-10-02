import { notFound } from "next/navigation";
import type { Post } from "@/lib/blog";
import { getCategories } from "@/lib/supabase/categories";
import { createClient } from "@/lib/supabase/server";
import { PostEditor } from "../PostEditor";

export const metadata = { title: "Edit post" };

export default async function EditPostPage({ params }: PageProps<"/admin/blog/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: post }, categories] = await Promise.all([
    supabase
      .from("posts")
      .select("id, title, slug, content, category_id, status, published_at, updated_at")
      .eq("id", id)
      .maybeSingle()
      .overrideTypes<Post, { merge: false }>(),
    getCategories(),
  ]);
  if (!post) notFound();

  return <PostEditor key={post.id} post={post} categories={categories} />;
}
