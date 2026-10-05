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
        className="rounded-full border border-accent bg-transparent px-5 py-2.5 text-center placeholder:text-muted focus:outline-none"
      />
      <input
        name="password"
        type="password"
        placeholder="Password"
        autoComplete="current-password"
        required
        className="rounded-full border border-accent bg-transparent px-5 py-2.5 text-center placeholder:text-muted focus:outline-none"
      />
      {/* Enter in either field submits too. */}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-accent px-5 py-2.5 font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        Log In
      </button>
      <p aria-live="polite" className="min-h-5 text-center text-sm">
        {pending ? (
          <span className="text-muted">Signing in…</span>
        ) : (
          state?.error && <span className="text-danger">{state.error}</span>
        )}
      </p>
    </form>
  );
}
