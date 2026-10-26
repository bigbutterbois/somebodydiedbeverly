"use client";

import { useActionState } from "react";
import { rerunForecast } from "./actions";

// Reruns the whole forecast (fresh scrape and simulations) after a confirm,
// since it replaces today's published numbers.
export function RerunButton({ disabled }: { disabled?: boolean }) {
  const [state, action, pending] = useActionState(rerunForecast, null);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Rerun today's forecast? It replaces the numbers on the site.")) e.preventDefault();
      }}
      className="flex flex-wrap items-center gap-3"
    >
      <button
        type="submit"
        disabled={disabled || pending}
        className="rounded border border-line px-3 py-1.5 text-sm hover:border-accent hover:text-accent disabled:opacity-50"
      >
        {pending ? "Starting…" : "Rerun forecast"}
      </button>
      {state && <p className={`text-sm ${state.ok ? "text-muted" : "text-danger"}`}>{state.message}</p>}
    </form>
  );
}
