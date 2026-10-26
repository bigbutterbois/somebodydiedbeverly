import { appSignIn } from "@/lib/supabase/app-auth";

// The iPhone app's version of /login: owner email and password in, Supabase
// tokens out. Supabase's own rate limits apply to wrong guesses.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const result = email && password ? await appSignIn(email, password) : null;
  if (!result) return Response.json({ error: "That email and password didn't work." }, { status: 401 });
  return Response.json(result);
}
