import Link from "next/link";

const TABS = [
  { key: "overview", href: "/admin/election", label: "Overview" },
  { key: "swing", href: "/admin/election/swing", label: "Swing map" },
] as const;

/** Sub-tabs at the top of Admin → Election. */
export function ElectionTabs({ active }: { active: (typeof TABS)[number]["key"] }) {
  return (
    <nav className="flex gap-4 border-b border-line text-sm">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`-mb-px border-b-2 pb-2 ${t.key === active ? "border-accent text-foreground" : "border-transparent text-muted hover:text-foreground"}`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
