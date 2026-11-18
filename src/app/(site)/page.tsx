import Link from "next/link";
import { EmptyPreview, HomeSection } from "@/components/HomeSection";
import Image from "next/image";
import { galleryImageUrl } from "@/lib/gallery";
import { getGalleryItems } from "@/lib/supabase/gallery";
import { contentClient } from "@/lib/supabase/content";
import { getSiteText } from "@/lib/supabase/site-text";
import { loadSwing } from "./election/swing/data";
import { SwingPreview } from "./election/swing/SwingPreview";
import { MetroPreview } from "./metro/MetroMap";

// Homepage: the Blue tsunami map and the live Metro map first, then the
// latest from the gallery and plate tracker.
export default async function Home() {
  const supabase = await contentClient();
  const [{ count: totalCountries }, { data: sightings }, pieces, swing, t] = await Promise.all([
    supabase.from("countries").select("id", { count: "exact", head: true }),
    supabase.from("plate_sightings").select("country_id"),
    getGalleryItems(3),
    loadSwing(),
    getSiteText(),
  ]);
  const spotted = new Set(sightings?.map((s) => s.country_id)).size;

  return (
    <div className="flex flex-col gap-14 py-6">
      <header className="flex flex-col gap-3">
        <h1 className="max-w-2xl text-4xl font-light tracking-tight text-balance sm:text-5xl">
          {t("home.title")}
        </h1>
        <p className="text-muted">{t("home.intro")}</p>
      </header>

      <HomeSection title={t("home.swing.title")} href="/election" more={t("home.seeAll")}>
        {swing ? (
          <Link href="/election" aria-label="Open the Blue tsunami map">
            <SwingPreview data={swing} />
          </Link>
        ) : (
          <EmptyPreview>{t("home.swing.empty")}</EmptyPreview>
        )}
      </HomeSection>

      <HomeSection title={t("home.metro.title")} href="/metro" more={t("home.seeAll")}>
        <Link href="/metro" aria-label="Open the live Metro map">
          <MetroPreview />
        </Link>
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
