import Image from "next/image";
import Link from "next/link";
import { galleryImageUrl } from "@/lib/gallery";
import { getGalleryItems } from "@/lib/supabase/gallery";

export const metadata = { title: "Gallery" };

export default async function GalleryPage() {
  const items = await getGalleryItems();

  return (
    <div className="flex flex-col gap-10 py-6">
      <h1 className="text-4xl font-light tracking-tight">Gallery</h1>
      {items.length === 0 ? (
        <p className="text-muted">New pieces will show up here.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((item, index) => (
            <li key={item.id}>
              <Link href={`/gallery/${item.id}`} className="group flex flex-col gap-2">
                <div className="relative aspect-square bg-surface">
                  <Image
                    src={galleryImageUrl(item.image_path)}
                    alt={item.title}
                    fill
                    sizes="(max-width: 640px) 50vw, 33vw"
                    priority={index < 3}
                    className="object-cover transition-opacity group-hover:opacity-90"
                  />
                </div>
                {item.title && <span className="text-sm text-muted group-hover:text-foreground">{item.title}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
