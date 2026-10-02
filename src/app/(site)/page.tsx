import Link from "next/link";
import { EmptyPreview, HomeSection } from "@/components/HomeSection";
import Image from "next/image";
import { formatPostDate } from "@/lib/blog";
import { galleryImageUrl } from "@/lib/gallery";
import { getGalleryItems } from "@/lib/supabase/gallery";
import { createClient } from "@/lib/supabase/server";

// Homepage: a preview of the latest from every public module. Each module
// replaces its empty state with real items once it has data.
export default async function Home() {
  const supabase = await createClient();
  const [{ count: totalCountries }, { data: sightings }, { data: posts }, pieces] = await Promise.all([
    supabase.from("countries").select("id", { count: "exact", head: true }),
    supabase.from("plate_sightings").select("country_id"),
    supabase
      .from("posts")
      .select("id, title, slug, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(3),
    getGalleryItems(3),
  ]);
  const spotted = new Set(sightings?.map((s) => s.country_id)).size;

  return (
    <div className="flex flex-col gap-14 py-6">
      <header className="flex flex-col gap-3">
        <h1 className="max-w-2xl text-4xl font-light tracking-tight text-balance sm:text-5xl">
          Paintings, notes, and the occasional election model.
        </h1>
        <p className="text-muted">A small site for friends and family.</p>
      </header>

      <HomeSection title="Recent work" href="/gallery">
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) =>
            pieces[i] ? (
              <Link key={i} href={`/gallery/${pieces[i].id}`} className="relative aspect-square bg-surface">
                <Image
                  src={galleryImageUrl(pieces[i].image_path)}
                  alt={pieces[i].title}
                  fill
                  sizes="33vw"
                  className="object-cover"
                />
              </Link>
            ) : (
              <div key={i} className="aspect-square bg-surface" />
            ),
          )}
        </div>
        {pieces.length === 0 && <EmptyPreview>New pieces will show up here.</EmptyPreview>}
      </HomeSection>

      <div className="grid gap-14 md:grid-cols-2">
        <HomeSection title="Latest posts" href="/blog">
          {posts?.length ? (
            <ul className="flex flex-col gap-3">
              {posts.map((post) => (
                <li key={post.id} className="flex flex-col">
                  <Link href={`/blog/${post.slug}`} className="hover:text-accent">
                    {post.title}
                  </Link>
                  <span className="text-xs text-muted tabular-nums">
                    {formatPostDate(post.published_at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyPreview>No posts yet.</EmptyPreview>
          )}
        </HomeSection>

        <HomeSection title="Forecast" href="/forecast">
          <EmptyPreview>The election model is still being built.</EmptyPreview>
        </HomeSection>

        <HomeSection title="Diplomat plates" href="/plates">
          <p className="tabular-nums">
            <span className="text-2xl">{spotted}</span>
            <span className="text-muted"> of {totalCountries ?? 0} countries spotted</span>
          </p>
        </HomeSection>
      </div>
    </div>
  );
}
