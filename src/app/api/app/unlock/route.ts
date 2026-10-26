import { checkSitePassword } from "@/lib/check-password";

// The iPhone app's version of /enter: trades the friends & family password for
// the same access token the website keeps in its cookie. The app stores it in
// the Keychain and sends it as "Authorization: Bearer <token>" (src/proxy.ts).
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  const result = await checkSitePassword(password, "/api/app/unlock");
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ token: result.token });
}
