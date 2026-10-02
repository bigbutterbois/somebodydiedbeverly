import { getCategories } from "@/lib/supabase/categories";
import { PostEditor } from "../PostEditor";

export const metadata = { title: "New post" };

export default async function NewPostPage() {
  return <PostEditor categories={await getCategories()} />;
}
