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
    return ["somebodydiedbeverly.com", "www.somebodydiedbeverly.com"].map((host) => ({
      source: "/:path*",
      has: [{ type: "host" as const, value: host }],
      destination: "https://www.wilfullymisunderstand.com/:path*",
      permanent: true,
    }));
  },
};

export default nextConfig;
