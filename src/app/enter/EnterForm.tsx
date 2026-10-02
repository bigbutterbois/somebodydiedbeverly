"use client";

import { useActionState } from "react";
import { enterSite } from "./actions";

export function EnterForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(enterSite, null);

  return (
    <form action={formAction} className="flex w-full max-w-xs flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <input
        name="password"
        type="password"
        placeholder="Password"
        autoComplete="current-password"
        autoFocus
        required
        className="rounded border border-line bg-surface px-3 py-2 placeholder:text-muted focus:border-accent focus:outline-none"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-accent px-3 py-2 font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Checking…" : "Enter"}
      </button>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
    </form>
  );
}
