import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/plates";

export const metadata = { title: "Plate tracker" };

type Row = {
  id: string;
  country_id: string;
  date_spotted: string;
  note: string | null;
  countries: { name: string } | null;
};

export default async function PlatesAdminPage() {
  const supabase = await createClient();
  const [{ data: sightings }, { count: total }] = await Promise.all([
    supabase
      .from("plate_sightings")
      .select("id, date_spotted, note, country_id, countries(name)")
      .order("date_spotted", { ascending: false })
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
                className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3 hover:text-accent"
              >
                <span className="w-28 shrink-0 text-sm text-muted tabular-nums">
                  {formatDate(s.date_spotted)}
                </span>
                <span>{s.countries?.name}</span>
                {s.note && <span className="text-sm text-muted">{s.note}</span>}
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
