import Link from "next/link";
import { getCountries } from "@/lib/supabase/countries";
import { logSighting } from "../actions";
import { SightingForm } from "../SightingForm";

export const metadata = { title: "Log a plate" };

export default async function LogPlatePage() {
  const countries = await getCountries();

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-3xl font-normal tracking-tight">Log a plate</h1>
        <Link href="/admin/plates" className="text-sm text-muted hover:text-foreground">
          All sightings
        </Link>
      </div>
      <SightingForm
        countries={countries}
        action={logSighting}
        submitLabel="Save sighting"
        autoFocus
      />
    </div>
  );
}
