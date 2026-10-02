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
        className="rounded-full border border-accent bg-transparent px-5 py-2.5 text-center placeholder:text-muted focus:outline-none"
      />
      {/* Enter submits; the button is only there for screen readers. */}
      <button type="submit" disabled={pending} className="sr-only">
        Enter
      </button>
      <p aria-live="polite" className="min-h-5 text-center text-sm">
        {pending ? (
          <span className="text-muted">Checking…</span>
        ) : (
          state?.error && <span className="text-danger">{state.error}</span>
        )}
      </p>
    </form>
  );
}
