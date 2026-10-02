import Link from "next/link";
import { formatPostDate } from "@/lib/blog";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Blog" };

type Row = {
  id: string;
  title: string;
  status: "draft" | "published";
  published_at: string | null;
  updated_at: string;
  categories: { name: string } | null;
};

export default async function BlogAdminPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("posts")
    .select("id, title, status, published_at, updated_at, categories(name)")
    .order("updated_at", { ascending: false })
    .overrideTypes<Row[], { merge: false }>();
  const posts = data ?? [];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-normal tracking-tight">Blog</h1>
        <Link
          href="/admin/blog/new"
          className="rounded bg-accent px-4 py-2 font-medium text-background transition-opacity hover:opacity-90"
        >
          New post
        </Link>
      </header>

      {posts.length === 0 ? (
        <p className="text-muted">No posts yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line border-y border-line">
          {posts.map((post) => (
            <li key={post.id}>
              <Link
                href={`/admin/blog/${post.id}`}
                className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3 hover:text-accent"
              >
                <span className={post.title ? "" : "text-muted"}>{post.title || "Untitled"}</span>
                {post.categories && <span className="text-sm text-muted">{post.categories.name}</span>}
                <span className="ml-auto text-sm text-muted tabular-nums">
                  {post.status === "published" && post.published_at
                    ? formatPostDate(post.published_at)
                    : `Draft · edited ${formatPostDate(post.updated_at)}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
