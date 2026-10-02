import type { MetadataRoute } from "next";

// The site is private to friends and family, so keep every crawler out.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
