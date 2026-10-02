import { createClient } from "./server";

// Supabase client for admin Server Actions. Server Actions can be called by a
// direct POST from anywhere, so each one checks the owner is signed in before
// writing. Row level security enforces the same rule in the database.
export async function ownerClient() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims || data.claims.is_anonymous) {
    throw new Error("Only the site owner can do that.");
  }
  return supabase;
}
