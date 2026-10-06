"use client";

import { useState, useTransition } from "react";
import { saveSiteText } from "./actions";

// One editable piece of wording. Shows Save once it's changed, and Reset when
// it differs from the default.
export function TextField({
  id,
  label,
  kind,
  fills,
  defaultText,
  saved,
}: {
  id: string;
  label: string;
  kind: "short" | "long" | "notes";
  fills?: string[];
  defaultText: string;
  saved: string | null;
}) {
  const current = saved ?? defaultText;
  const [value, setValue] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const changed = value !== current;

  function save(next: string | null) {
    setError(null);
    startTransition(async () => {
      try {
        await saveSiteText(id, next);
        setValue(next === null ? defaultText : next.trim());
      } catch {
        setError("That didn't save. Try again.");
      }
    });
  }

  const inputClass =
    "w-full rounded border border-line bg-surface px-3 py-2 text-sm placeholder:text-muted focus:border-accent focus:outline-none";

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm">
        {label}
      </label>
      {kind === "short" ? (
        <input id={id} value={value} onChange={(e) => setValue(e.target.value)} className={inputClass} />
      ) : (
        <textarea
          id={id}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={kind === "notes" ? 9 : 2}
          className={`${inputClass} field-sizing-content`}
        />
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        {kind === "notes" && <span>Blank line between paragraphs · &ldquo;- &rdquo; for a bullet · **bold**</span>}
        {fills && <span>Filled in by the page: {fills.map((f) => `{${f}}`).join(", ")}</span>}
        {saved !== null && !changed && <span className="text-accent">Edited</span>}
        {error && <span className="text-danger">{error}</span>}
        <span className="ml-auto flex gap-4">
          {saved !== null && (
            <button type="button" onClick={() => save(null)} disabled={pending} className="hover:text-foreground disabled:opacity-50">
              Reset to default
            </button>
          )}
          {changed && (
            <>
              <button type="button" onClick={() => setValue(current)} disabled={pending} className="hover:text-foreground disabled:opacity-50">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => save(value)}
                disabled={pending}
                className="rounded bg-accent px-3 py-1 font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {pending ? "Saving…" : "Save"}
              </button>
            </>
          )}
        </span>
      </div>
    </div>
  );
}
