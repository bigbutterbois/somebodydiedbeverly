"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = ["/metro", "/metro/map"];

/** Arrivals / Map switch at the top of the Metro pages. */
export function MetroTabs({ labels }: { labels: string[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 text-sm" aria-label="Metro">
      {TABS.map((href, i) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full border px-3 py-1 transition-colors ${
              active ? "border-accent bg-accent text-background" : "border-line text-muted hover:text-foreground"
            }`}
          >
            {labels[i]}
          </Link>
        );
      })}
    </nav>
  );
}
