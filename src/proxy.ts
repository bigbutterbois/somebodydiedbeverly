import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isPreviewBot, previewHtml } from "@/lib/link-preview";
import { ACCESS_COOKIE, hasSiteAccess } from "@/lib/site-access";

// Pages anyone can open: the two sign-in screens, the iPhone app's version of
// /enter, plus the home-screen app's manifest and service worker, which phones
// fetch without cookies.
const OPEN_PATHS = ["/enter", "/login", "/api/app/unlock", "/manifest.webmanifest", "/sw.js"];

// Runs before every page. Two gates:
// - /admin needs the owner signed in (Supabase Auth).
// - everything else needs the friends & family password, or the owner.
export async function proxy(request: NextRequest) {
  // Link preview fetchers (iMessage, WhatsApp…) get a title and the WM image
  // instead of the password page (see src/lib/link-preview.ts).
  if (isPreviewBot(request.headers.get("user-agent"))) {
    return new NextResponse(previewHtml(request.nextUrl.pathname, request.nextUrl.origin), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  // Also refreshes the owner's session cookie when it's close to expiring.
  const { data } = await supabase.auth.getClaims();
  const isOwner = Boolean(data?.claims) && !data?.claims.is_anonymous;

  const { pathname, search } = request.nextUrl;
  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    if (path === "/enter") url.searchParams.set("next", pathname + search);
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (pathname.startsWith("/admin")) {
    if (!isOwner) return redirectTo("/login");
  } else if (!OPEN_PATHS.includes(pathname) && !isOwner) {
    // The website sends the access token as a cookie; the iPhone app sends the
    // same token as a bearer header (see src/app/api/app/unlock).
    const bearer = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
    const allowed = await hasSiteAccess(
      request.cookies.get(ACCESS_COOKIE)?.value ?? bearer,
    );
    if (!allowed) {
      // API callers get a status they can act on instead of the password page.
      if (pathname.startsWith("/api/")) {
        return Response.json({ error: "Enter the site password first." }, { status: 401 });
      }
      return redirectTo("/enter");
    }
  }

  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and image optimization.
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
