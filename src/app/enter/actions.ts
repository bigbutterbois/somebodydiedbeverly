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

export async function enterSite(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const password = process.env.SITE_PASSWORD;
  if (!password) return { error: "The site password hasn't been set up yet." };

  if (!safeEqual(String(formData.get("password") ?? ""), password)) {
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
