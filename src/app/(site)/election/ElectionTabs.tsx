"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const TABS = [
  { href: "/election", label: "County swing" },
  { href: "/election/live", label: "Live results" },
];

/** County swing / Live results switch at the top of the election page. Keeps ?demo= across tabs. */
export function ElectionTabs() {
  const pathname = usePathname();
  const demo = useSearchParams().get("demo");
  return (
    <nav className="flex gap-1 text-sm" aria-label="Election">
      {TABS.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={demo ? `${href}?demo=${demo}` : href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full border px-3 py-1 transition-colors ${
              active ? "border-accent bg-accent text-background" : "border-line text-muted hover:text-foreground"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
