// Gallery types and helpers shared by the public and admin pages.

export type GalleryItem = {
  id: string;
  title: string;
  image_path: string;
  width: number;
  height: number;
  display_order: number;
};

export const GALLERY_COLUMNS = "id, title, image_path, width, height, display_order";

// Public URL of an image in the "gallery" storage bucket.
export function galleryImageUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/gallery/${path}`;
}
