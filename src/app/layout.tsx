import type { Metadata } from "next";
import { Work_Sans } from "next/font/google";
import { PREVIEW_DESCRIPTION, SITE_NAME } from "@/lib/link-preview";
import "./globals.css";

const workSans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin"],
});

const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "www.wilfullymisunderstand.com";

// The Open Graph tags matter for the password page, which is where any link
// preview fetcher the proxy doesn't recognize ends up (see src/lib/link-preview.ts).
export const metadata: Metadata = {
  metadataBase: new URL(`https://${productionHost}`),
  title: { template: `%s · ${SITE_NAME}`, default: SITE_NAME },
  description: PREVIEW_DESCRIPTION,
  robots: { index: false, follow: false },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: PREVIEW_DESCRIPTION,
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${workSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
