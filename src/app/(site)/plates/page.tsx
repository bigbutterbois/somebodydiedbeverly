import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Country } from "@/lib/plates";
import { PlateLookup } from "./PlateLookup";

export const metadata = { title: "Diplomat plates" };

type Row = Country & { plate_sightings: { id: string }[] };

export default async function PlatesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("countries")
    .select("id, name, slug, plate_codes, plate_sightings(id)")
    .order("name")
    .overrideTypes<Row[], { merge: false }>();

  const countries = (data ?? []).map(({ plate_sightings, ...country }) => ({
    ...country,
    sightings: plate_sightings.length,
  }));
  const spotted = countries.filter((c) => c.sightings > 0).length;
  const percent = countries.length ? (spotted / countries.length) * 100 : 0;

  return (
    <div className="flex flex-col gap-10 py-6">
      <header className="flex flex-col gap-4">
        <h1 className="text-4xl font-light tracking-tight">Diplomat plates</h1>
        <p className="max-w-xl text-muted">
          Every country whose diplomatic license plate Mike has spotted so far.
        </p>
        <div className="flex flex-col gap-2">
          <p className="tabular-nums">
            <span className="text-2xl">{spotted}</span>
            <span className="text-muted"> of {countries.length} countries spotted</span>
          </p>
          <div className="h-1 w-full max-w-md bg-surface">
            <div className="h-full bg-accent" style={{ width: `${percent}%` }} />
          </div>
        </div>
      </header>

      <PlateLookup countries={countries} />

      <section className="flex flex-col gap-4">
        <h2 className="border-b border-line pb-2 text-xs uppercase tracking-[0.12em] text-muted">
          Checklist
        </h2>
        <ul className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
          {countries.map((c) => (
            <li key={c.id}>
              <Link
                href={`/plates/${c.slug}`}
                className="flex items-baseline gap-3 border-b border-line/50 py-2 hover:text-accent"
              >
                <span aria-hidden className={c.sightings ? "text-accent" : "text-line"}>
                  {c.sightings ? "●" : "○"}
                </span>
                <span className={c.sightings ? "" : "text-muted"}>{c.name}</span>
                {c.sightings > 1 && (
                  <span className="ml-auto shrink-0 text-xs text-muted tabular-nums">
                    {c.sightings}×
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
