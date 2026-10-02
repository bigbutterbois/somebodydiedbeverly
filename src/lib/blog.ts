// Blog types and helpers shared by the public and admin pages.

export type Category = { id: string; name: string; slug: string };

export type PostStatus = "draft" | "published";

export type Post = {
  id: string;
  title: string;
  slug: string;
  content: string;
  category_id: string | null;
  status: PostStatus;
  published_at: string | null;
  updated_at: string;
};

// "Oct 2, 2026", in Eastern time so a late-night post keeps its day.
export function formatPostDate(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
