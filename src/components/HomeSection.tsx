import Link from "next/link";
import type { ReactNode } from "react";

// One module's preview block on the homepage: a heading, a "see all" link,
// and whatever latest items the module passes in.
export function HomeSection({
  title,
  href,
  more,
  children,
}: {
  title: string;
  href: string;
  /** The "see all" link's wording. */
  more: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4 border-b border-line pb-2">
        <h2 className="text-xs uppercase tracking-[0.12em] text-muted">{title}</h2>
        <Link href={href} className="text-sm text-accent hover:underline">
          {more}
        </Link>
      </div>
      {children}
    </section>
  );
}

export function EmptyPreview({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}
