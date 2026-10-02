"use client";

import Link from "next/link";
import { useState } from "react";
import { lookupPlate, type Country } from "@/lib/plates";

// Type a plate (or just its letters) to see which country it belongs to.
export function PlateLookup({ countries }: { countries: Country[] }) {
  const [plate, setPlate] = useState("");
  const matches = lookupPlate(plate, countries);
  const letters = plate.replace(/[^a-z]/gi, "").length;

  return (
    <section className="flex flex-col gap-3">
      <label htmlFor="plate" className="text-xs uppercase tracking-[0.12em] text-muted">
        Whose plate is that?
      </label>
      <input
        id="plate"
        value={plate}
        onChange={(e) => setPlate(e.target.value)}
        placeholder="e.g. DAF 1234"
        autoComplete="off"
        autoCapitalize="characters"
        className="w-full max-w-xs rounded border border-line bg-surface px-3 py-2 uppercase tabular-nums placeholder:normal-case placeholder:text-muted focus:border-accent focus:outline-none"
      />
      {matches.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {matches.map(({ country, role }) => (
            <li key={`${country.id}-${role}`}>
              <Link href={`/plates/${country.slug}`} className="text-accent hover:underline">
                {country.name}
              </Link>
              {role && <span className="text-muted"> · {role}</span>}
            </li>
          ))}
        </ul>
      ) : (
        letters >= 2 && <p className="text-sm text-muted">No country uses that code.</p>
      )}
    </section>
  );
}
