import { Monogram } from "@/components/Monogram";
import { Nav } from "@/components/Nav";

// Public side: unlocked by the friends & family password (see src/proxy.ts).
// Add a module by creating its folder here and linking it below.
const MODULES = [
  { href: "/gallery", label: "Gallery" },
  { href: "/blog", label: "Blog" },
  { href: "/forecast", label: "Forecast" },
];

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Nav home={{ href: "/", label: <Monogram className="text-sm" /> }} links={MODULES} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col p-6">
        {children}
      </main>
    </>
  );
}
