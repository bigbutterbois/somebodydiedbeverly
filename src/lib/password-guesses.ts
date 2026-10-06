import "server-only";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

// Brute-force protection for the friends & family password (see the
// password_guesses migration). After ten wrong guesses in an hour from one IP
// address, the password page stops checking that address's guesses until the
// hour rolls over. Devices that are already in aren't affected.
const MAX_WRONG_PER_HOUR = 10;

// HMAC of the IP keyed by the site password: stable across the hour, never
// the address itself, and not something anyone outside the site can compute.
async function guesserKey(password: string): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`guesses:${ip}`));
  return Buffer.from(signature).toString("base64url");
}

// True when this visitor has used up the hour's guesses. If the
// check itself fails, let the guess through rather than lock family out.
export async function tooManyGuesses(password: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc("password_failures_recent", {
      p_key: await guesserKey(password),
    });
    return typeof data === "number" && data >= MAX_WRONG_PER_HOUR;
  } catch {
    return false;
  }
}

export async function recordWrongGuess(password: string) {
  try {
    const supabase = await createClient();
    await supabase.rpc("record_password_failure", { p_key: await guesserKey(password) });
  } catch {
    // Best-effort, like the visit log.
  }
}
