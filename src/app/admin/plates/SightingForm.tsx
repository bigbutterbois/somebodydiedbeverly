"use client";

import { useActionState, useState } from "react";
import { searchCountries, type Country } from "@/lib/plates";
import type { LogState } from "./actions";

const inputClass =
  "w-full rounded border border-line bg-surface px-3 py-3 text-base placeholder:text-muted focus:border-accent focus:outline-none";

// Log or edit one sighting: country type-ahead (by name or plate code), date,
// optional note. Sized for a phone.
export function SightingForm({
  countries,
  action,
  initial,
  submitLabel,
  autoFocus = false,
}: {
  countries: Country[];
  action: (prev: LogState, formData: FormData) => Promise<LogState>;
  initial: { country?: Country; date: string; note?: string };
  submitLabel: string;
  autoFocus?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <div className="flex flex-col gap-4">
      {state?.saved && (
        <p className="text-sm text-accent" role="status">
          Saved {state.saved}.
        </p>
      )}
      {/* A fresh key after each save clears the form for the next plate. */}
      <form key={state?.at ?? 0} action={formAction} className="flex flex-col gap-4">
        <CountryPicker countries={countries} initial={initial.country} autoFocus={autoFocus} />
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-[0.12em] text-muted">Date</span>
          <input
            name="date_spotted"
            type="date"
            defaultValue={initial.date}
            required
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-[0.12em] text-muted">Note</span>
          <textarea
            name="note"
            rows={2}
            defaultValue={initial.note}
            placeholder="Optional"
            className={inputClass}
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-accent px-3 py-3 text-base font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      </form>
    </div>
  );
}

function CountryPicker({
  countries,
  initial,
  autoFocus,
}: {
  countries: Country[];
  initial?: Country;
  autoFocus: boolean;
}) {
  const [selected, setSelected] = useState<Country | undefined>(initial);
  const [query, setQuery] = useState("");
  const matches = searchCountries(query, countries).slice(0, 8);

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-[0.12em] text-muted">Country</span>
      <input type="hidden" name="country_id" value={selected?.id ?? ""} />
      {selected ? (
        <div className="flex items-center justify-between gap-3 rounded border border-accent bg-surface px-3 py-3">
          <span>
            {selected.name}{" "}
            <span className="text-sm text-muted tabular-nums">{selected.plate_codes.join(", ")}</span>
          </span>
          <button
            type="button"
            onClick={() => setSelected(undefined)}
            className="text-sm text-muted underline hover:text-foreground"
          >
            Change
          </button>
        </div>
      ) : (
        <>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && matches[0]) {
                e.preventDefault();
                setSelected(matches[0]);
                setQuery("");
              }
            }}
            placeholder="Name or plate code, e.g. Japan or DAF"
            autoFocus={autoFocus}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            className={inputClass}
          />
          {matches.length > 0 && (
            <ul className="flex flex-col divide-y divide-line rounded border border-line">
              {matches.map((country) => (
                <li key={country.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(country);
                      setQuery("");
                    }}
                    className="flex w-full items-baseline justify-between gap-3 px-3 py-3 text-left hover:bg-surface"
                  >
                    <span>{country.name}</span>
                    <span className="text-sm text-muted tabular-nums">
                      {country.plate_codes.join(", ")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
