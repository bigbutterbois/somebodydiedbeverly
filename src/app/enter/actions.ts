"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { checkSitePassword } from "@/lib/check-password";
import { ACCESS_COOKIE, ACCESS_MAX_AGE, safeNextPath } from "@/lib/site-access";

export async function enterSite(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const result = await checkSitePassword(String(formData.get("password") ?? ""), "/enter");
  if ("error" in result) return { error: result.error };

  const cookieStore = await cookies();
  cookieStore.set(ACCESS_COOKIE, result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_MAX_AGE,
  });

  redirect(safeNextPath(formData.get("next")));
}
