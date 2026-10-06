import Link from "next/link";
import { notFound } from "next/navigation";
import { contentClient } from "@/lib/supabase/content";
import type { Country } from "@/lib/plates";

type Row = Country & { plate_sightings: { id: string }[] };

// How a country code shows up on each kind of plate.
const PLATE_FORMATS = [
  { label: "Diplomat", plate: (code: string) => `D${code}` },
  { label: "Consul", plate: (code: string) => `C${code}` },
  { label: "Staff", plate: (code: string) => `S${code}` },
  { label: "UN diplomat", plate: (code: string) => `${code}D` },
];

async function getCountry(slug: string) {
  const supabase = await contentClient();
  const { data } = await supabase
    .from("countries")
    .select("id, name, slug, plate_codes, plate_sightings(id)")
    .eq("slug", slug)
    .maybeSingle()
    .overrideTypes<Row, { merge: false }>();
  return data;
}

export async function generateMetadata({ params }: PageProps<"/plates/[slug]">) {
  const country = await getCountry((await params).slug);
  return { title: country?.name ?? "Diplomat plates" };
}

export default async function CountryPlatesPage({ params }: PageProps<"/plates/[slug]">) {
  const country = await getCountry((await params).slug);
  if (!country) notFound();
  const sightings = country.plate_sightings;

  return (
    <div className="flex flex-col gap-8 py-6">
      <Link href="/plates" className="text-sm text-muted hover:text-foreground">
        ← All countries
      </Link>
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-light tracking-tight">{country.name}</h1>
        <p className="text-muted">
          {sightings.length === 0
            ? "Not spotted yet."
            : `Spotted ${sightings.length} ${sightings.length === 1 ? "time" : "times"}.`}
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="border-b border-line pb-2 text-xs uppercase tracking-[0.12em] text-muted">
          Plate codes
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 tabular-nums">
          {PLATE_FORMATS.map(({ label, plate }) => (
            <div key={label} className="contents">
              <dt className="text-muted">{label}</dt>
              <dd>{country.plate_codes.map(plate).join(", ")}</dd>
            </div>
          ))}
        </dl>
      </section>

    </div>
  );
}
