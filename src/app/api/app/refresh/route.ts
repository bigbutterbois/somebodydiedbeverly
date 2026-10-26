import { appRefresh } from "@/lib/supabase/app-auth";

// Swaps the iPhone app's refresh token for fresh tokens when its access token
// (good for an hour) runs out.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const refreshToken = typeof body?.refresh_token === "string" ? body.refresh_token : "";
  const result = refreshToken ? await appRefresh(refreshToken) : null;
  if (!result) return Response.json({ error: "Sign in again." }, { status: 401 });
  return Response.json(result);
}
