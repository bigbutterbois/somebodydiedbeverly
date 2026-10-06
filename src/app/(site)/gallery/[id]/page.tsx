import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { galleryImageUrl } from "@/lib/gallery";
import { getGalleryItems } from "@/lib/supabase/gallery";
import { getSiteText } from "@/lib/supabase/site-text";

async function getPiece(id: string) {
  const items = await getGalleryItems();
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return null;
  return { item: items[index], previous: items[index - 1], next: items[index + 1] };
}

export async function generateMetadata({ params }: PageProps<"/gallery/[id]">) {
  const piece = await getPiece((await params).id);
  return { title: piece?.item.title || "Gallery" };
}

export default async function GalleryPiecePage({ params }: PageProps<"/gallery/[id]">) {
  const piece = await getPiece((await params).id);
  if (!piece) notFound();
  const t = await getSiteText();
  const { item, previous, next } = piece;

  return (
    <div className="flex flex-col gap-6 py-6">
      <Link href="/gallery" className="text-sm text-muted hover:text-foreground">
        {t("gallery.back")}
      </Link>
      <figure className="flex flex-col items-center gap-4">
        <Image
          src={galleryImageUrl(item.image_path)}
          alt={item.title}
          width={item.width}
          height={item.height}
          sizes="(max-width: 1024px) 100vw, 1024px"
          priority
          className="max-h-[75vh] w-auto object-contain"
        />
        {item.title && <figcaption className="text-muted">{item.title}</figcaption>}
      </figure>
      <nav className="flex justify-between text-sm">
        {previous ? (
          <Link href={`/gallery/${previous.id}`} className="text-accent hover:underline">
            {t("gallery.previous")}
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link href={`/gallery/${next.id}`} className="text-accent hover:underline">
            {t("gallery.next")}
          </Link>
        )}
      </nav>
    </div>
  );
}
