"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export type NavLink = { href: string; label: string };

export function Nav({
  home,
  links,
  children,
}: {
  home: { href: string; label: ReactNode };
  links: NavLink[];
  children?: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line px-6 py-4">
      <Link href={home.href} className="font-semibold tracking-tight">
        {home.label}
      </Link>
      {links.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "text-sm text-accent"
                : "text-sm text-muted transition-colors hover:text-foreground"
            }
          >
            {link.label}
          </Link>
        );
      })}
      {children && <div className="ml-auto">{children}</div>}
    </nav>
  );
}
