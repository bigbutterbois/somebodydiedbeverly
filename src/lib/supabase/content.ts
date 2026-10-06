import "server-only";
import { createClient } from "@supabase/supabase-js";
import { connection } from "next/server";

// Supabase client for reading the public side's content (posts, gallery,
// plates) on the server. The database doesn't let the public key read these
// tables, so the friends & family password can't be skipped by asking
// Supabase directly; the server reads them with the secret key instead, and
// only after src/proxy.ts has checked the password. The secret key skips row
// level security, so queries here must filter out drafts themselves. Never
// import this from a client component.
//
// Falls back to the public key while SUPABASE_SECRET_KEY isn't set, which
// only works until the lockdown migration runs.
export async function contentClient() {
  // Read fresh on every request, like the cookie-based client does, rather
  // than freezing the content into the build.
  await connection();
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
