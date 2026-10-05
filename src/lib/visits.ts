import "server-only";
import { headers } from "next/headers";
import { userAgent } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type VisitKind = "view" | "bad_password";

// Records one visit for the admin Visitors page. Never stores the IP address:
// location comes from Vercel's geo headers, and the visitor id is a hash of
// IP + browser + today's date (Eastern), so it only counts unique visitors
// within a day. Skips bots and the signed-in owner. Never throws: a failed
// log must not break the page.
export async function logVisit(kind: VisitKind, path: string, referrer?: string) {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (data?.claims && !data.claims.is_anonymous) return;

    const h = await headers();
    const ua = userAgent({ headers: h });
    if (ua.isBot) return;

    const ip =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "";
    const geo = (name: string) => {
      const value = h.get(name);
      if (!value) return null;
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    };

    await supabase.rpc("log_visit", {
      p_kind: kind,
      p_path: path,
      p_referrer: referrerHost(referrer, h.get("host")),
      p_country: geo("x-vercel-ip-country"),
      p_region: geo("x-vercel-ip-country-region"),
      p_city: geo("x-vercel-ip-city"),
      p_device: ua.device.type ?? "desktop",
      p_browser: ua.browser.name ?? null,
      p_os: ua.os.name ?? null,
      p_visitor: ip ? await visitorId(ip, h.get("user-agent") ?? "") : null,
    });
  } catch {
    // Stats are best-effort.
  }
}

// Just the site that linked here, and nothing for links within this site.
function referrerHost(referrer: string | undefined, host: string | null) {
  if (!referrer) return null;
  try {
    const url = new URL(referrer);
    const name = url.hostname.replace(/^www\./, "");
    return host && name === host.replace(/^www\./, "").split(":")[0] ? null : name;
  } catch {
    return null;
  }
}

// One-way, salted with a secret and the date, so it can't be reversed to an IP
// or linked across days.
async function visitorId(ip: string, ua: string) {
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const secret = process.env.SITE_PASSWORD ?? "";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${secret}|${day}|${ip}|${ua}`),
  );
  return Buffer.from(digest).toString("base64url").slice(0, 22);
}
