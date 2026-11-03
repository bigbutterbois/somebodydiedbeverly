import { getElectionPosts } from "@/lib/election/posts";

// The live blog's posts, for the election page's once-a-minute update.
export async function GET() {
  return Response.json(await getElectionPosts(), { headers: { "Cache-Control": "no-store" } });
}
