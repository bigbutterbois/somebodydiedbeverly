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
        className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-foreground px-3 py-2 text-background disabled:opacity-50"
      >
        {pending ? "Checking…" : "Enter"}
      </button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
