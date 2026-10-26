"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ACCESS_COOKIE,
  ACCESS_MAX_AGE,
  accessToken,
  safeEqual,
  safeNextPath,
} from "@/lib/site-access";
import { recordWrongGuess, tooManyGuesses } from "@/lib/password-guesses";
import { logVisit } from "@/lib/visits";

export async function enterSite(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const password = process.env.SITE_PASSWORD;
  if (!password) return { error: "The site password hasn't been set up yet." };

  if (await tooManyGuesses(password)) {
    return { error: "Too many tries. Wait an hour and try again." };
  }

  // Case-insensitive, so "Beverly" and "beverly" both work. The cookie is still
  // derived from SITE_PASSWORD exactly as set, so devices already in stay in.
  const entered = String(formData.get("password") ?? "");
  if (!safeEqual(entered.toLowerCase(), password.toLowerCase())) {
    await Promise.all([logVisit("bad_password", "/enter"), recordWrongGuess(password)]);
    return { error: "That's not the password." };
  }

  const cookieStore = await cookies();
  cookieStore.set(ACCESS_COOKIE, await accessToken(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_MAX_AGE,
  });

  redirect(safeNextPath(formData.get("next")));
}
