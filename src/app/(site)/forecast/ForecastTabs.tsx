"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/forecast", label: "Both" },
  { href: "/forecast/senate", label: "Senate" },
  { href: "/forecast/house", label: "House" },
];

/** Both / Senate / House switch at the top of every admin forecast page. */
export function ForecastTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 text-sm" aria-label="Forecast">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full border px-3 py-1 transition-colors ${
              active ? "border-accent bg-accent text-background" : "border-line text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
