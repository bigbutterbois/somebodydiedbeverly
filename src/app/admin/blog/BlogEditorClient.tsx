'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import type { Post } from '@/lib/blog'

const TiptapEditor = dynamic(() => import('@/components/editor/TiptapEditor'), {
  ssr: false,
  loading: () => (
    <div className="border border-border-dark bg-charcoal h-[200px] flex items-center justify-center">
      <span className="text-[11px] text-text-muted tracking-[0.04em]">loading editor…</span>
    </div>
  ),
})

interface Props {
  post?: Post
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

export default function BlogEditorClient({ post }: Props) {
  const router = useRouter()
  const isEditing = !!post

  const [title, setTitle] = useState(post?.title ?? '')
  const [slug, setSlug] = useState(post?.slug ?? '')
  const [content, setContent] = useState(post?.content ?? '')
  const [published, setPublished] = useState(post?.published ?? false)
  const [passwordEnabled, setPasswordEnabled] = useState(!!post?.password)
  const [password, setPassword] = useState(post?.password ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function handleTitleChange(val: string) {
    setTitle(val)
    if (!isEditing) {
      setSlug(slugify(val))
    }
  }

  async function handleSave() {
    if (!title.trim() || !slug.trim()) {
      setError('title and slug are required')
      return
    }

    setSaving(true)
    setError('')

    try {
      const body = {
        title: title.trim(),
        slug: slug.trim(),
        content,
        published,
        password: passwordEnabled && password ? password : null,
        id: post?.id,
      }

      const res = await fetch('/api/blog/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'save failed')
        return
      }

      router.push('/blog')
      router.refresh()
    } catch {
      setError('something went wrong')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!post || !window.confirm('delete this post?')) return

    setSaving(true)
    try {
      await fetch('/api/blog/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: post.id }),
      })
      router.push('/blog')
      router.refresh()
    } catch {
      setError('delete failed')
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'bg-[#1c1c1a] border border-border-dark text-text-primary font-sans text-[13px] tracking-[0.02em] px-3 py-2 outline-none w-full transition-colors duration-150 focus:border-accent placeholder:text-text-muted'

  return (
    <div className="min-h-screen bg-charcoal">
      {/* minimal header */}
      <div className="border-b border-border-dark px-6 sm:px-10 h-[52px] flex items-center justify-between bg-nav-bg">
        <span className="text-[12px] text-text-secondary tracking-[0.04em]">
          {isEditing ? 'edit post' : 'new post'}
        </span>
        <div className="flex items-center gap-3">
          {isEditing && (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="text-[11px] text-[#b84040] tracking-[0.04em] hover:text-[#d45050] transition-colors duration-150 disabled:opacity-50"
            >
              delete
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-[11px] text-text-muted border border-border-dark px-3 py-1.5 tracking-[0.04em] hover:text-text-primary hover:border-text-muted transition-colors duration-150 disabled:opacity-50"
          >
            {saving ? 'saving…' : published ? 'save & publish' : 'save draft'}
          </button>
        </div>
      </div>

      <div className="max-w-post mx-auto px-6 sm:px-10 pt-10 pb-24 flex flex-col gap-6">
        {/* title */}
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="post title"
          className={inputClass}
        />

        {/* slug */}
        <div className="flex flex-col gap-1">
          <label className="text-[10.5px] text-text-muted tracking-[0.08em]">slug</label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="post-slug"
            className={inputClass}
          />
        </div>

        {/* editor */}
        <TiptapEditor content={content} onChange={setContent} />

        {/* options row */}
        <div className="flex flex-col sm:flex-row gap-4 pt-2 border-t border-border-dark">
          {/* publish toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setPublished(!published)}
              className={`w-8 h-4 rounded-full relative transition-colors duration-200 cursor-pointer ${
                published ? 'bg-accent' : 'bg-border-dark'
              }`}
            >
              <div
                className={`absolute top-0.5 w-3 h-3 rounded-full bg-charcoal transition-transform duration-200 ${
                  published ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </div>
            <span className="text-[11.5px] text-text-secondary tracking-[0.04em]">
              {published ? 'published' : 'draft'}
            </span>
          </label>

          {/* password toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setPasswordEnabled(!passwordEnabled)}
              className={`w-8 h-4 rounded-full relative transition-colors duration-200 cursor-pointer ${
                passwordEnabled ? 'bg-accent' : 'bg-border-dark'
              }`}
            >
              <div
                className={`absolute top-0.5 w-3 h-3 rounded-full bg-charcoal transition-transform duration-200 ${
                  passwordEnabled ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </div>
            <span className="text-[11.5px] text-text-secondary tracking-[0.04em]">
              password protected
            </span>
          </label>

          {passwordEnabled && (
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="set password"
              className="bg-[#1c1c1a] border border-border-dark text-text-primary font-sans text-[12px] tracking-[0.04em] px-3 py-1.5 outline-none transition-colors duration-150 focus:border-accent placeholder:text-text-muted w-48"
            />
          )}
        </div>

        {error && (
          <p className="text-[11px] text-[#b84040] tracking-[0.03em]">{error}</p>
        )}
      </div>
    </div>
  )
}
