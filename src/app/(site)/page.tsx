import Link from "next/link";
import { EmptyPreview, HomeSection } from "@/components/HomeSection";
import Image from "next/image";
import { formatPostDate } from "@/lib/blog";
import { DEM, REP, getForecast, getHouseForecast, outOf100, type Forecast } from "@/lib/forecast";
import { galleryImageUrl } from "@/lib/gallery";
import { CircleGrid } from "./forecast/CircleGrid";
import { OUTCOMES, outcomeOdds } from "./forecast/outcomes";
import { getGalleryItems } from "@/lib/supabase/gallery";
import { contentClient } from "@/lib/supabase/content";
import { getSiteText } from "@/lib/supabase/site-text";

// Homepage: a preview of the latest from every public module. Each module
// replaces its empty state with real items once it has data.
export default async function Home() {
  const supabase = await contentClient();
  const [{ count: totalCountries }, { data: sightings }, { data: posts }, pieces, senate, house, t] = await Promise.all([
    supabase.from("countries").select("id", { count: "exact", head: true }),
    supabase.from("plate_sightings").select("country_id"),
    supabase
      .from("posts")
      .select("id, title, slug, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(3),
    getGalleryItems(3),
    getForecast(),
    getHouseForecast(),
    getSiteText(),
  ]);
  const spotted = new Set(sightings?.map((s) => s.country_id)).size;
  const split = senate && house ? outcomeOdds(senate.p_dem_control, house.p_dem_control, house.p_dem_both ?? null) : null;

  return (
    <div className="flex flex-col gap-14 py-6">
      <header className="flex flex-col gap-3">
        <h1 className="max-w-2xl text-4xl font-light tracking-tight text-balance sm:text-5xl">
          {t("home.title")}
        </h1>
        <p className="text-muted">{t("home.intro")}</p>
      </header>

      <HomeSection title={t("home.forecast.title")} href="/forecast" more={t("home.seeAll")}>
        {senate && house ? (
          <Link href="/forecast" className="flex flex-col gap-6 tabular-nums">
            <div className="flex flex-wrap gap-x-10 gap-y-4">
              <ChamberOdds label={t("home.forecast.chance", { chamber: "Senate" })} forecast={senate} />
              <ChamberOdds label={t("home.forecast.chance", { chamber: "House" })} forecast={house} />
            </div>
            {split && (
              <div className="flex flex-col items-center gap-5 sm:flex-row">
                <CircleGrid odds={split} className="w-40 shrink-0" />
                <ul className="flex w-full flex-col gap-2 text-sm sm:max-w-sm">
                  {OUTCOMES.map((o, i) => (
                    <li key={o.label} className="flex items-baseline gap-2">
                      <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: o.color }} />
                      <span className="flex-1">{o.label}</span>
                      <span style={{ color: o.color }}>{outOf100(split[i])}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Link>
        ) : (
          <EmptyPreview>{t("home.forecast.empty")}</EmptyPreview>
        )}
      </HomeSection>

      <HomeSection title={t("home.blog.title")} href="/blog" more={t("home.seeAll")}>
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
          <EmptyPreview>{t("home.blog.empty")}</EmptyPreview>
        )}
      </HomeSection>

      <HomeSection title={t("home.gallery.title")} href="/gallery" more={t("home.seeAll")}>
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
        {pieces.length === 0 && <EmptyPreview>{t("home.gallery.empty")}</EmptyPreview>}
      </HomeSection>

      <HomeSection title={t("home.plates.title")} href="/plates" more={t("home.seeAll")}>
        <p className="tabular-nums">
          <span className="text-2xl">{spotted}</span>
          <span className="text-muted"> {t("home.plates.count", { total: totalCountries ?? 0 })}</span>
        </p>
      </HomeSection>
    </div>
  );
}

function ChamberOdds({ label, forecast }: { label: string; forecast: Forecast }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted">{label}</p>
      <p className="flex gap-6">
        <span>
          <span className="text-2xl" style={{ color: DEM }}>{Math.round(forecast.p_dem_control * 100)}%</span>
          <span className="text-muted"> Dem</span>
        </span>
        <span>
          <span className="text-2xl" style={{ color: REP }}>{Math.round(forecast.p_rep_control * 100)}%</span>
          <span className="text-muted"> Rep</span>
        </span>
      </p>
    </div>
  );
}
