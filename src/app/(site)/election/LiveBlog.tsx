"use client";

import { useEffect, useState } from "react";
import type { ElectionPost } from "@/lib/election/posts";

const POLL_MS = 60_000;
const SHOWN = 3;

// Mike's live commentary at the top of the election page. Checks for new
// posts once a minute while the page is open; shows the newest few, with the
// rest behind a button.
export function LiveBlog({ initial }: { initial: ElectionPost[] }) {
  const [posts, setPosts] = useState(initial);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const tick = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/election/posts", { cache: "no-store" });
        if (res.ok) setPosts((await res.json()) as ElectionPost[]);
      } catch {
        // Try again next minute.
      }
    };
    const id = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  if (!posts.length) return null;
  const shown = open ? posts : posts.slice(0, SHOWN);

  return (
    <section aria-label="Live updates" className="flex max-w-2xl flex-col gap-4">
      {shown.map((p, i) => (
        <article key={p.id} className={`flex flex-col gap-1 border-l-2 pl-4 ${i === 0 ? "border-accent" : "border-line"}`}>
          <p className="text-xs text-muted">
            <span className="font-medium text-foreground">WM Admin</span> · {stamp(p.created_at)}
          </p>
          <p className="whitespace-pre-line text-sm leading-relaxed">{p.body}</p>
        </article>
      ))}
      {posts.length > SHOWN && (
        <button type="button" onClick={() => setOpen(!open)} className="self-start text-sm text-accent underline">
          {open ? "Show fewer" : `Show all ${posts.length} updates`}
        </button>
      )}
    </section>
  );
}

function stamp(iso: string) {
  return (
    new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) +
    " ET"
  );
}
