import type { MetadataRoute } from "next";
import { PREVIEW_DESCRIPTION, SITE_NAME } from "@/lib/link-preview";

// Lets phones install the site as a full-screen app with its own icon
// ("Add to Home Screen" in Safari's Share menu). Served without the password
// (see OPEN_PATHS in src/proxy.ts) because browsers fetch it without cookies.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: "Wilfully",
    description: PREVIEW_DESCRIPTION,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#121315",
    theme_color: "#121315",
    icons: [
      { src: "/app/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/app/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/app/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
