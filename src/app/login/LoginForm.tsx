"use client";

import { useActionState } from "react";
import { signIn } from "./actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signIn, null);

  return (
    <form action={formAction} className="flex w-full max-w-xs flex-col gap-3">
      <input
        name="email"
        type="email"
        placeholder="Email"
        autoComplete="email"
        required
        className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
      />
      <input
        name="password"
        type="password"
        placeholder="Password"
        autoComplete="current-password"
        required
        className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-foreground px-3 py-2 text-background disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
