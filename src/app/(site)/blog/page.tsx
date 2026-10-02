import Link from "next/link";
import { formatPostDate } from "@/lib/blog";
import { getCategories } from "@/lib/supabase/categories";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Blog" };

type Row = {
  id: string;
  title: string;
  slug: string;
  published_at: string;
  categories: { name: string; slug: string } | null;
};

export default async function BlogPage({ searchParams }: PageProps<"/blog">) {
  const { category } = await searchParams;
  const supabase = await createClient();
  const categories = await getCategories();
  const current = categories.find((c) => c.slug === category);

  let query = supabase
    .from("posts")
    .select("id, title, slug, published_at, categories(name, slug)")
    .eq("status", "published")
    .order("published_at", { ascending: false });
  if (current) query = query.eq("category_id", current.id);
  const { data } = await query.overrideTypes<Row[], { merge: false }>();
  const posts = data ?? [];

  return (
    <div className="flex flex-col gap-10 py-6">
      <header className="flex flex-col gap-4">
        <h1 className="text-4xl font-light tracking-tight">Blog</h1>
        {categories.length > 0 && (
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <Link href="/blog" className={current ? "text-muted hover:text-foreground" : "text-accent"}>
              All
            </Link>
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/blog?category=${c.slug}`}
                className={current?.id === c.id ? "text-accent" : "text-muted hover:text-foreground"}
              >
                {c.name}
              </Link>
            ))}
          </nav>
        )}
      </header>

      {posts.length === 0 ? (
        <p className="text-muted">No posts yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line border-y border-line">
          {posts.map((post) => (
            <li key={post.id}>
              <Link href={`/blog/${post.slug}`} className="group flex flex-col gap-1 py-5 sm:flex-row sm:items-baseline sm:gap-6">
                <span className="w-28 shrink-0 text-sm text-muted tabular-nums">
                  {formatPostDate(post.published_at)}
                </span>
                <span className="text-xl font-light tracking-tight group-hover:text-accent">{post.title}</span>
                {post.categories && (
                  <span className="text-xs uppercase tracking-[0.12em] text-muted sm:ml-auto">
                    {post.categories.name}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
