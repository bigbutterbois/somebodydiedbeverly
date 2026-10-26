import "server-only";
import { recordWrongGuess, tooManyGuesses } from "@/lib/password-guesses";
import { accessToken, safeEqual } from "@/lib/site-access";
import { logVisit } from "@/lib/visits";

export type PasswordCheck = { token: string } | { error: string; status: number };

// The friends & family password check shared by the /enter page and the
// iPhone app: guess limit, case-insensitive match, and the access token a
// correct guess earns. `path` is what a wrong guess is logged under.
export async function checkSitePassword(entered: string, path: string): Promise<PasswordCheck> {
  const password = process.env.SITE_PASSWORD;
  if (!password) return { error: "The site password hasn't been set up yet.", status: 503 };

  if (await tooManyGuesses(password)) {
    return { error: "Too many tries. Wait an hour and try again.", status: 429 };
  }

  // Case-insensitive, so "Beverly" and "beverly" both work. The token is still
  // derived from SITE_PASSWORD exactly as set, so devices already in stay in.
  if (!safeEqual(entered.toLowerCase(), password.toLowerCase())) {
    await Promise.all([logVisit("bad_password", path), recordWrongGuess(password)]);
    return { error: "That's not the password.", status: 401 };
  }

  return { token: await accessToken(password) };
}
