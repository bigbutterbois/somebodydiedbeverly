import Link from "next/link";
import { Monogram } from "@/components/Monogram";
import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { VisitTracker } from "./VisitTracker";

// Public side: unlocked by the friends & family password (see src/proxy.ts).
// Add a module by creating its folder here and linking it below.
const MODULES = [
  { href: "/gallery", label: "Gallery" },
  { href: "/blog", label: "Blog" },
  { href: "/forecast", label: "Forecast" },
  { href: "/plates", label: "Plates" },
];

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const isOwner = Boolean(data?.claims) && !data?.claims.is_anonymous;

  return (
    <>
      <Nav home={{ href: "/", label: <Monogram className="text-sm" /> }} links={MODULES}>
        <Link
          href={isOwner ? "/admin" : "/login"}
          className="rounded-full border border-accent px-3 py-1 text-sm text-accent transition-colors hover:bg-accent hover:text-background"
        >
          {isOwner ? "Admin" : "Log in"}
        </Link>
      </Nav>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col p-6">
        {children}
      </main>
      {!isOwner && <VisitTracker />}
    </>
  );
}
