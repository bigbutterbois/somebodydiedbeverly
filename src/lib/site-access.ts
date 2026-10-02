// Friends & family access: one shared password (SITE_PASSWORD) unlocks the
// public side of the site. A correct password sets a long-lived cookie, so each
// device only has to enter it once.
//
// The cookie holds an HMAC derived from the password itself, so changing
// SITE_PASSWORD in Vercel signs every device out. Uses Web Crypto so the same
// code runs in the proxy and in server actions.

export const ACCESS_COOKIE = "sdb_access";

// Browsers cap cookie lifetimes at 400 days.
export const ACCESS_MAX_AGE = 60 * 60 * 24 * 400;

const encoder = new TextEncoder();

export async function accessToken(password: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode("sdb-site-access-v1"),
  );
  return Buffer.from(signature).toString("base64url");
}

// Constant-time comparison so response timing doesn't leak how much matched.
export function safeEqual(a: string, b: string): boolean {
  const x = encoder.encode(a);
  const y = encoder.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  }
  return diff === 0;
}

export async function hasSiteAccess(
  cookieValue: string | undefined,
): Promise<boolean> {
  const password = process.env.SITE_PASSWORD;
  if (!password || !cookieValue) return false;
  return safeEqual(cookieValue, await accessToken(password));
}

// Only allow redirects back to a path on this site.
export function safeNextPath(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//")
    ? next
    : "/";
}
