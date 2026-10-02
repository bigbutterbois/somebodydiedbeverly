"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { Category, Post, PostStatus } from "@/lib/blog";
import { slugify } from "@/lib/slug";
import { createCategory, deletePost, savePost } from "./actions";
import { RichTextEditor } from "./RichTextEditor";

const NEW_CATEGORY = "__new";

const inputClass =
  "rounded border border-line bg-surface px-3 py-2 placeholder:text-muted focus:border-accent focus:outline-none";

export function PostEditor({ post, categories: initialCategories }: { post?: Post; categories: Category[] }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const [id, setId] = useState(post?.id);
  const [status, setStatus] = useState<PostStatus>(post?.status ?? "draft");
  const [publishedAt, setPublishedAt] = useState(post?.published_at ?? null);
  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  // The URL follows the title until it's edited by hand or the post has been saved.
  const [slugTouched, setSlugTouched] = useState(Boolean(post));
  const [content, setContent] = useState(post?.content ?? "");
  const [categories, setCategories] = useState(initialCategories);
  const [categoryId, setCategoryId] = useState(post?.category_id ?? "");
  const [newCategory, setNewCategory] = useState<string | null>(null);

  const save = (nextStatus: PostStatus) =>
    startTransition(async () => {
      setMessage(null);
      const result = await savePost({
        id,
        title,
        slug: slug || slugify(title),
        content,
        category_id: categoryId || null,
        status: nextStatus,
        published_at: publishedAt,
      });
      if (!result.ok) return setMessage({ text: result.error, error: true });

      setStatus(nextStatus);
      setSlug(result.slug);
      setSlugTouched(true);
      setPublishedAt(result.published_at);
      setMessage({
        text:
          nextStatus === "published"
            ? status === "published" ? "Saved." : "Published."
            : status === "published" ? "Unpublished. It's a draft again." : "Draft saved.",
      });
      if (!id) {
        setId(result.id);
        // Point the address bar at the saved post without reloading the editor.
        window.history.replaceState(null, "", `/admin/blog/${result.id}`);
      }
    });

  const addCategory = () =>
    startTransition(async () => {
      const result = await createCategory(newCategory ?? "");
      if (!result.ok) return setMessage({ text: result.error, error: true });
      setCategories((list) => [...list, result.category].sort((a, b) => a.name.localeCompare(b.name)));
      setCategoryId(result.category.id);
      setNewCategory(null);
    });

  const remove = () => {
    if (!id || !confirm("Delete this post? This can't be undone.")) return;
    startTransition(() => deletePost(id));
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/blog" className="text-sm text-muted hover:text-foreground">
          ← All posts
        </Link>
        <span className="text-xs uppercase tracking-[0.12em] text-muted">
          {status === "published" ? "Published" : "Draft"}
        </span>
      </div>

      <input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          if (!slugTouched) setSlug(slugify(e.target.value));
        }}
        placeholder="Title"
        aria-label="Title"
        className="bg-transparent text-3xl font-normal tracking-tight placeholder:text-muted focus:outline-none"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-[0.12em] text-muted">URL</span>
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted">/blog/</span>
            <input
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugTouched(true);
              }}
              onBlur={() => setSlug(slugify(slug))}
              className={`${inputClass} min-w-0 flex-1`}
            />
          </div>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-[0.12em] text-muted">Category</span>
          {newCategory === null ? (
            <select
              value={categoryId}
              onChange={(e) => {
                if (e.target.value === NEW_CATEGORY) setNewCategory("");
                else setCategoryId(e.target.value);
              }}
              className={inputClass}
            >
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value={NEW_CATEGORY}>+ New category…</option>
            </select>
          ) : (
            <div className="flex gap-2">
              <input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCategory();
                  }
                }}
                placeholder="New category"
                autoFocus
                className={`${inputClass} min-w-0 flex-1`}
              />
              <button type="button" onClick={addCategory} disabled={pending} className="text-sm text-accent">
                Add
              </button>
              <button type="button" onClick={() => setNewCategory(null)} className="text-sm text-muted">
                Cancel
              </button>
            </div>
          )}
        </label>
      </div>

      <RichTextEditor initialContent={post?.content ?? ""} onChange={setContent} />

      <div className="flex flex-wrap items-center gap-3">
        {status === "draft" ? (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => save("published")}
              className="rounded bg-accent px-4 py-2 font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Publish
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => save("draft")}
              className="rounded border border-line px-4 py-2 hover:border-muted disabled:opacity-50"
            >
              Save draft
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => save("published")}
              className="rounded bg-accent px-4 py-2 font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => save("draft")}
              className="rounded border border-line px-4 py-2 hover:border-muted disabled:opacity-50"
            >
              Unpublish
            </button>
            <Link href={`/blog/${slug}`} className="text-sm text-accent hover:underline">
              View post
            </Link>
          </>
        )}
        {id && (
          <button type="button" disabled={pending} onClick={remove} className="ml-auto text-sm text-danger underline">
            Delete
          </button>
        )}
      </div>
      {message && (
        <p className={`text-sm ${message.error ? "text-danger" : "text-accent"}`} role="status">
          {message.text}
        </p>
      )}
    </div>
  );
}
