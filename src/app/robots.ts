import type { MetadataRoute } from "next";

// The site is private to friends and family, so keep every crawler out.
// Link preview fetchers are let in so texted links get a card; they only ever
// see the stub page from src/lib/link-preview.ts, which is also noindex.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: ["facebookexternalhit", "Facebot", "Twitterbot"], allow: "/" },
      { userAgent: "*", disallow: "/" },
    ],
  };
}
