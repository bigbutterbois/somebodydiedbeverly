// Lets the iPhone app check its saved token still works (the proxy answers 401
// when it doesn't, for example after SITE_PASSWORD changes).
export function GET() {
  return Response.json({ ok: true });
}
