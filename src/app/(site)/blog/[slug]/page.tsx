import Link from "next/link";
import { notFound } from "next/navigation";
import { formatPostDate } from "@/lib/blog";
import { createClient } from "@/lib/supabase/server";

type Row = {
  title: string;
  content: string;
  published_at: string;
  categories: { name: string; slug: string } | null;
};

async function getPost(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("posts")
    .select("title, content, published_at, categories(name, slug)")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle()
    .overrideTypes<Row, { merge: false }>();
  return data;
}

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">) {
  const post = await getPost((await params).slug);
  return { title: post?.title ?? "Blog" };
}

export default async function PostPage({ params }: PageProps<"/blog/[slug]">) {
  const post = await getPost((await params).slug);
  if (!post) notFound();

  return (
    <article className="mx-auto flex w-full max-w-2xl flex-col gap-8 py-6">
      <header className="flex flex-col gap-3">
        <p className="flex gap-3 text-xs uppercase tracking-[0.12em] text-muted">
          <span className="tabular-nums">{formatPostDate(post.published_at)}</span>
          {post.categories && (
            <Link href={`/blog?category=${post.categories.slug}`} className="hover:text-foreground">
              {post.categories.name}
            </Link>
          )}
        </p>
        <h1 className="text-4xl font-light tracking-tight text-balance">{post.title}</h1>
      </header>
      {/* The owner's own HTML from the admin editor. */}
      <div className="post-body" dangerouslySetInnerHTML={{ __html: post.content }} />
      <Link href="/blog" className="text-sm text-accent hover:underline">
        ← All posts
      </Link>
    </article>
  );
}
