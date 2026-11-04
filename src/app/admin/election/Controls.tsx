"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { rebuildChartHistory, refreshNow } from "./actions";

// Reloads the page's numbers every 30 seconds, and a button to read every
// state feed right now (it works outside election night too, for testing).
export function Controls() {
  const router = useRouter();
  const [state, action, pending] = useActionState(refreshNow, null);
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(id);
  }, [router]);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-line px-3 py-1.5 text-sm hover:border-accent hover:text-accent disabled:opacity-50"
      >
        {pending ? "Reading feeds…" : "Refresh now"}
      </button>
      {state && <p className={`text-sm ${state.ok ? "text-muted" : "text-danger"}`}>{state.message}</p>}
      <RebuildButton />
    </form>
  );
}

/** Reruns tonight's chart history through the current model, batch after batch until done. */
function RebuildButton() {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; message: string } | null>(null);
  const run = async () => {
    setBusy(true);
    try {
      for (;;) {
        const r = await rebuildChartHistory();
        setNote(r);
        if (!r.ok || r.left === 0) break;
      }
    } catch (e) {
      setNote({ ok: false, message: e instanceof Error ? e.message : String(e) });
    }
    setBusy(false);
  };
  return (
    <>
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="rounded border border-line px-3 py-1.5 text-sm hover:border-accent hover:text-accent disabled:opacity-50"
      >
        {busy ? "Rebuilding chart history…" : "Rebuild chart history"}
      </button>
      {note && <p className={`text-sm ${note.ok ? "text-muted" : "text-danger"}`}>{note.message}</p>}
    </>
  );
}
