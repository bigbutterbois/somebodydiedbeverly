// Lets the iPhone app check its saved sign-in still works (the proxy answers
// 401 when it doesn't).
export function GET() {
  return Response.json({ ok: true });
}
