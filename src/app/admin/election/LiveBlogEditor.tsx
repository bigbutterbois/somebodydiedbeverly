"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import type { ElectionPost } from "@/lib/election/posts";
import { addPost, deletePost, editPost } from "./actions";

// Write a live blog post for /election, and edit or delete earlier ones.
export function LiveBlogEditor({ posts }: { posts: ElectionPost[] }) {
  const [state, action, pending] = useActionState(addPost, null);
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
            <PostRow key={p.id} post={p} />
          ))}
        </ul>
      )}
    </section>
  );
}

function PostRow({ post }: { post: ElectionPost }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(post.body);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const time = new Date(post.created_at).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
  const button = "shrink-0 text-xs text-muted disabled:opacity-50";

  return (
    <li className="flex items-start gap-3 border-b border-line pb-2">
      <span className="shrink-0 text-xs text-muted tabular-nums">
        {time}
        {post.author && post.author !== "WM Admin" && <span className="block">{post.author}</span>}
      </span>
      {editing ? (
        <div className="flex flex-1 flex-col gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            className="rounded border border-line bg-transparent p-2 text-sm"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                start(async () => {
                  const res = await editPost(post.id, text);
                  if (res.ok) {
                    setEditing(false);
                    setError(null);
                  } else setError(res.message);
                })
              }
              className="rounded border border-line px-3 py-1 text-sm hover:border-accent hover:text-accent disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setText(post.body);
                setEditing(false);
                setError(null);
              }}
              className={`${button} hover:text-foreground`}
            >
              Cancel
            </button>
            {error && <p className="text-sm text-danger">{error}</p>}
          </div>
        </div>
      ) : (
        <>
          <span className="flex-1 whitespace-pre-line">{post.body}</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setText(post.body);
              setEditing(true);
            }}
            className={`${button} hover:text-accent`}
          >
            Edit
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (confirm("Delete this post?")) start(() => deletePost(post.id));
            }}
            className={`${button} hover:text-danger`}
          >
            Delete
          </button>
        </>
      )}
    </li>
  );
}
