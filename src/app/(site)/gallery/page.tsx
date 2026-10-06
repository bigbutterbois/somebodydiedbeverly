import Image from "next/image";
import Link from "next/link";
import { galleryImageUrl, type GalleryItem } from "@/lib/gallery";
import { getGalleryItems } from "@/lib/supabase/gallery";
import { getSiteText } from "@/lib/supabase/site-text";

export const metadata = { title: "Gallery" };

// Splits pieces into two columns, each going to whichever column is shorter
// so far. Keeps Mike's order reading left to right, top to bottom, and keeps
// the columns close in height even though every piece has its own shape.
function toColumns(items: GalleryItem[]): GalleryItem[][] {
  const columns: GalleryItem[][] = [[], []];
  const heights = [0, 0];
  for (const item of items) {
    const shorter = heights[1] < heights[0] ? 1 : 0;
    columns[shorter].push(item);
    heights[shorter] += item.height / item.width;
  }
  return columns;
}

export default async function GalleryPage() {
  const [items, t] = await Promise.all([getGalleryItems(), getSiteText()]);
  const firstIds = new Set(items.slice(0, 4).map((item) => item.id));

  return (
    <div className="flex flex-col gap-10 py-6">
      <h1 className="text-4xl font-light tracking-tight">{t("gallery.title")}</h1>
      {items.length === 0 ? (
        <p className="text-muted">{t("gallery.empty")}</p>
      ) : (
        <div className="grid grid-cols-2 items-start gap-3">
          {toColumns(items).map((column, index) => (
            <ul key={index} className="flex flex-col gap-3">
              {column.map((item) => (
                <li key={item.id}>
                  <Link href={`/gallery/${item.id}`} className="block bg-surface">
                    <Image
                      src={galleryImageUrl(item.image_path)}
                      alt={item.title}
                      width={item.width}
                      height={item.height}
                      sizes="(max-width: 1024px) 50vw, 512px"
                      priority={firstIds.has(item.id)}
                      className="h-auto w-full transition-opacity hover:opacity-90"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          ))}
        </div>
      )}
    </div>
  );
}
