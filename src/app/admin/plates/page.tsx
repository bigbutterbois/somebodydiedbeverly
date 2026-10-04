import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Plate tracker" };

type Row = {
  id: string;
  country_id: string;
  countries: { name: string } | null;
};

export default async function PlatesAdminPage() {
  const supabase = await createClient();
  const [{ data: sightings }, { count: total }] = await Promise.all([
    supabase
      .from("plate_sightings")
      .select("id, country_id, countries(name)")
      .order("created_at", { ascending: false })
      .overrideTypes<Row[], { merge: false }>(),
    supabase.from("countries").select("id", { count: "exact", head: true }),
  ]);
  const rows = sightings ?? [];
  const spotted = new Set(rows.map((s) => s.country_id)).size;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-normal tracking-tight">Plate tracker</h1>
          <p className="text-muted tabular-nums">
            {spotted} of {total ?? 0} countries spotted · {rows.length} sightings
          </p>
        </div>
        <Link
          href="/admin/plates/log"
          className="rounded bg-accent px-4 py-2 font-medium text-background transition-opacity hover:opacity-90"
        >
          Log a sighting
        </Link>
      </header>

      {rows.length === 0 ? (
        <p className="text-muted">No sightings yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line border-y border-line">
          {rows.map((s) => (
            <li key={s.id}>
              <Link
                href={`/admin/plates/${s.id}`}
                className="block py-3 hover:text-accent"
              >
                {s.countries?.name}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link href="/plates" className="text-sm text-accent hover:underline">
        View the public progress page
      </Link>
    </div>
  );
}
