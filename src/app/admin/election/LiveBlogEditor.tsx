"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import type { ElectionPost } from "@/lib/election/posts";
import { addPost, deletePost } from "./actions";

// Write a live blog post for /election, and delete earlier ones.
export function LiveBlogEditor({ posts }: { posts: ElectionPost[] }) {
  const [state, action, pending] = useActionState(addPost, null);
  const [deleting, startDelete] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs uppercase tracking-[0.12em] text-muted">Live blog</h2>
      <form ref={form} action={action} className="flex max-w-2xl flex-col gap-2">
        <textarea
          name="body"
          rows={3}
          required
          placeholder="One paragraph of commentary. Shows at the top of /election as WM Admin."
          className="rounded border border-line bg-transparent p-2 text-sm"
        />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded border border-line px-3 py-1.5 text-sm hover:border-accent hover:text-accent disabled:opacity-50"
          >
            {pending ? "Posting…" : "Post"}
          </button>
          {state && <p className={`text-sm ${state.ok ? "text-muted" : "text-danger"}`}>{state.message}</p>}
        </div>
      </form>
      {posts.length > 0 && (
        <ul className="flex max-w-2xl flex-col gap-2 text-sm">
          {posts.map((p) => (
            <li key={p.id} className="flex items-start gap-3 border-b border-line pb-2">
              <span className="shrink-0 text-xs text-muted tabular-nums">
                {new Date(p.created_at).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  timeZone: "America/New_York",
                })}
              </span>
              <span className="flex-1 whitespace-pre-line">{p.body}</span>
              <button
                type="button"
                disabled={deleting}
                onClick={() => {
                  if (confirm("Delete this post?")) startDelete(() => deletePost(p.id));
                }}
                className="shrink-0 text-xs text-muted hover:text-danger"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
