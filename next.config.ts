import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const nextConfig: NextConfig = {
  images: {
    // Gallery images live in the public Supabase Storage bucket.
    remotePatterns: supabaseUrl
      ? [new URL(`${supabaseUrl}/storage/v1/object/public/gallery/**`)]
      : [],
  },
  // The site used to live at somebodydiedbeverly.com. Old links keep working
  // and land on the same page at the new address.
  async redirects() {
    const oldDomain = ["somebodydiedbeverly.com", "www.somebodydiedbeverly.com"].map((host) => ({
      source: "/:path*",
      has: [{ type: "host" as const, value: host }],
      destination: "https://www.wilfullymisunderstand.com/:path*",
      permanent: true,
    }));
    // The forecast moved under the election page (Nov 5 2026). Its old landing
    // page opens the election page; the Senate and House pages keep their place.
    const forecast = [
      { source: "/forecast", destination: "/election", permanent: false },
      { source: "/forecast/:page(senate|house)", destination: "/election/forecast/:page", permanent: false },
    ];
    return [...oldDomain, ...forecast];
  },
};

export default nextConfig;
