import "server-only";
import { createClient, type Session } from "@supabase/supabase-js";

// Owner sign-in for the iPhone app. The app has no Supabase key of its own:
// it sends the owner's email and password (or a refresh token) here, and gets
// back Supabase tokens it keeps in the Keychain and sends as
// "Authorization: Bearer <access token>" (checked in src/proxy.ts).
function authClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export type AppTokens = { access_token: string; refresh_token: string; expires_at: number | null };

function tokens(session: Session): AppTokens {
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at ?? null,
  };
}

export async function appSignIn(email: string, password: string): Promise<AppTokens | null> {
  const { data, error } = await authClient().auth.signInWithPassword({ email, password });
  return error || !data.session ? null : tokens(data.session);
}

export async function appRefresh(refreshToken: string): Promise<AppTokens | null> {
  const { data, error } = await authClient().auth.refreshSession({ refresh_token: refreshToken });
  return error || !data.session ? null : tokens(data.session);
}
