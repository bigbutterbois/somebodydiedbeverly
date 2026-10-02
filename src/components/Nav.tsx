import Link from "next/link";

export type NavLink = { href: string; label: string };

export function Nav({ home, links }: { home: NavLink; links: NavLink[] }) {
  return (
    <nav className="flex flex-wrap items-baseline gap-x-6 gap-y-2 border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
      <Link href={home.href} className="font-semibold tracking-tight">
        {home.label}
      </Link>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="text-sm text-zinc-500 hover:text-foreground"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
