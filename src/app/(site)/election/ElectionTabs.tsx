"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const TABS = [
  { href: "/election", label: "Blue Tsunami" },
  { href: "/election/live", label: "Senate Projections" },
  { href: "/election/forecast", label: "Pre-Election Forecast" },
];

/** The election page's tabs: Blue Tsunami, Senate Projections, Pre-Election Forecast. Keeps ?demo= across tabs. */
export function ElectionTabs() {
  const pathname = usePathname();
  const demo = useSearchParams().get("demo");
  return (
    <nav className="flex gap-1 text-sm" aria-label="Election">
      {TABS.map(({ href, label }) => {
        const active = href === "/election" ? pathname === href : pathname.startsWith(href);
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
