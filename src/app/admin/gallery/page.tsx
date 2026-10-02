import { getGalleryItems } from "@/lib/supabase/gallery";
import { GalleryManager } from "./GalleryManager";

export const metadata = { title: "Gallery" };

export default async function GalleryAdminPage() {
  const items = await getGalleryItems();

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-normal tracking-tight">Gallery</h1>
      <GalleryManager initialItems={items} />
    </div>
  );
}
