"use client";

import { useEffect, useState } from "react";
import type { ElectionPost } from "@/lib/election/posts";

const POLL_MS = 60_000;

// Mike's live commentary under the election page's title, in a box about
// two posts tall; older posts scroll inside it. Checks for new posts once a minute while the page is open.
export function LiveBlog({ initial }: { initial: ElectionPost[] }) {
  const [posts, setPosts] = useState(initial);

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

  return (
    <section
      aria-label="Live updates"
      className="flex max-h-48 max-w-2xl flex-col gap-3 overflow-y-auto rounded border border-line p-3 text-xs md:max-h-60 md:gap-4 md:p-4 md:text-sm"
    >
      {posts.map((p, i) => (
        <article key={p.id} className={`flex flex-col gap-0.5 border-l-2 pl-3 ${i === 0 ? "border-accent" : "border-line"}`}>
          <p className="text-muted">
            <span className="font-medium text-foreground">{p.author ?? "WM Admin"}</span> · {stamp(p.created_at)}
          </p>
          <p className="whitespace-pre-line leading-relaxed">{p.body}</p>
        </article>
      ))}
    </section>
  );
}

function stamp(iso: string) {
  return (
    new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) +
    " ET"
  );
}
