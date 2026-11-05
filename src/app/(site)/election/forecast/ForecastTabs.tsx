"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = ["/election/forecast", "/election/forecast/senate", "/election/forecast/house"];

/** Both / Senate / House switch under the Pre-Election Forecast tab. */
export function ForecastTabs({ labels }: { labels: string[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 text-sm" aria-label="Forecast">
      {TABS.map((href, i) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full border px-3 py-1 transition-colors ${
              active ? "border-foreground text-foreground" : "border-line text-muted hover:text-foreground"
            }`}
          >
            {labels[i]}
          </Link>
        );
      })}
    </nav>
  );
}
