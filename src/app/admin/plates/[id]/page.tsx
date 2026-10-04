import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCountries } from "@/lib/supabase/countries";
import { deleteSighting, updateSighting } from "../actions";
import { DeleteButton } from "../DeleteButton";
import { SightingForm } from "../SightingForm";

export const metadata = { title: "Edit sighting" };

export default async function EditSightingPage({ params }: PageProps<"/admin/plates/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: sighting }, countries] = await Promise.all([
    supabase
      .from("plate_sightings")
      .select("id, country_id")
      .eq("id", id)
      .maybeSingle(),
    getCountries(),
  ]);
  if (!sighting) notFound();

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-3xl font-normal tracking-tight">Edit sighting</h1>
        <Link href="/admin/plates" className="text-sm text-muted hover:text-foreground">
          Cancel
        </Link>
      </div>
      <SightingForm
        countries={countries}
        action={updateSighting.bind(null, sighting.id)}
        initial={{
          country: countries.find((c) => c.id === sighting.country_id),
        }}
        submitLabel="Save changes"
      />
      <DeleteButton action={deleteSighting.bind(null, sighting.id)} />
    </div>
  );
}
