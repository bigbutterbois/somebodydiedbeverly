'use client'

import { useState, useRef, DragEvent } from 'react'
import type { GalleryItem } from '@/lib/gallery'

interface Props {
  initialItems: GalleryItem[]
}

export default function AdminGalleryClient({ initialItems }: Props) {
  const [items, setItems] = useState(initialItems)
  const [file, setFile] = useState<File | null>(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadDescription, setUploadDescription] = useState('')
  const [uploading, setUploading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f && f.type.startsWith('image/')) setFile(f)
  }

  async function handleUpload() {
    if (!file || !uploadTitle.trim()) {
      setError('image and title are required')
      return
    }
    setError('')
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', uploadTitle.trim())
      formData.append('description', uploadDescription)

      const res = await fetch('/api/gallery/upload', { method: 'POST', body: formData })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'upload failed')
        return
      }

      const newItem: GalleryItem = await res.json()
      setItems((prev) => [...prev, newItem])
      setFile(null)
      setUploadTitle('')
      setUploadDescription('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch {
      setError('upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(id: string, imageUrl: string) {
    if (!window.confirm('delete this image?')) return
    try {
      await fetch('/api/gallery/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, imageUrl }),
      })
      setItems((prev) => prev.filter((item) => item.id !== id))
    } catch {
      setError('delete failed')
    }
  }

  async function handleEditSave() {
    if (!editingId || !editTitle.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/gallery/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          title: editTitle.trim(),
          description: editDescription || null,
        }),
      })
      if (!res.ok) return
      const updated: GalleryItem = await res.json()
      setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      setEditingId(null)
    } catch {
      setError('update failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleMove(index: number, direction: 'up' | 'down') {
    const newItems = [...items]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= newItems.length) return

    ;[newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]]
    setItems(newItems)

    try {
      await fetch('/api/gallery/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds: newItems.map((item) => item.id) }),
      })
    } catch {
      setItems(items) // revert on error
    }
  }

  const inputClass =
    'bg-[#1c1c1a] border border-border-dark text-text-primary font-sans text-[12px] tracking-[0.02em] px-3 py-2 outline-none transition-colors duration-150 focus:border-accent placeholder:text-text-muted'

  return (
    <div className="min-h-screen bg-charcoal">
      {/* header */}
      <div className="border-b border-border-dark px-6 sm:px-10 h-[52px] flex items-center justify-between bg-nav-bg">
        <span className="text-[12px] text-text-secondary tracking-[0.04em]">gallery</span>
        <a
          href="/gallery"
          className="text-[11px] text-text-muted tracking-[0.04em] no-underline hover:text-text-primary transition-colors duration-150"
        >
          ← gallery
        </a>
      </div>

      <div className="max-w-2xl mx-auto px-6 sm:px-10 pt-10 pb-24 flex flex-col gap-8">
        {/* upload section */}
        <div className="flex flex-col gap-4">
          <span className="text-[10.5px] text-text-muted tracking-[0.08em]">upload image</span>

          {/* drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border border-dashed flex flex-col items-center justify-center py-10 cursor-pointer transition-colors duration-150 ${
              dragOver
                ? 'border-accent bg-[#1a1a18]'
                : 'border-border-dark hover:border-text-muted'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) setFile(f)
              }}
            />
            {file ? (
              <span className="text-[12px] text-text-primary tracking-[0.02em]">{file.name}</span>
            ) : (
              <span className="text-[12px] text-text-muted tracking-[0.04em]">
                drop image or click to select
              </span>
            )}
          </div>

          <input
            type="text"
            value={uploadTitle}
            onChange={(e) => setUploadTitle(e.target.value)}
            placeholder="title (required)"
            className={`${inputClass} w-full`}
          />
          <input
            type="text"
            value={uploadDescription}
            onChange={(e) => setUploadDescription(e.target.value)}
            placeholder="description (optional)"
            className={`${inputClass} w-full`}
          />

          <button
            onClick={handleUpload}
            disabled={uploading}
            className="self-start text-[11px] text-text-muted border border-border-dark px-4 py-2 tracking-[0.04em] hover:text-text-primary hover:border-text-muted transition-colors duration-150 disabled:opacity-50"
          >
            {uploading ? 'uploading…' : 'upload'}
          </button>
        </div>

        {error && (
          <p className="text-[11px] text-[#b84040] tracking-[0.03em]">{error}</p>
        )}

        {/* current items */}
        <div className="border-t border-border-dark pt-8 flex flex-col gap-4">
          <span className="text-[10.5px] text-text-muted tracking-[0.08em]">
            {items.length > 0 ? `current images (${items.length})` : 'no images yet'}
          </span>

          <div className="flex flex-col gap-px">
            {items.map((item, i) => (
              <div
                key={item.id}
                className="border border-border-dark p-4 flex gap-4 items-start bg-[#1a1a18]"
              >
                {/* thumbnail */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.image_url}
                  alt={item.title}
                  className="w-16 h-16 object-cover flex-shrink-0"
                />

                <div className="flex-1 min-w-0">
                  {editingId === item.id ? (
                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className={`${inputClass} w-full`}
                      />
                      <input
                        type="text"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="description"
                        className={`${inputClass} w-full`}
                      />
                      <div className="flex gap-3">
                        <button
                          onClick={handleEditSave}
                          disabled={saving}
                          className="text-[11px] text-text-muted tracking-[0.04em] hover:text-text-primary transition-colors duration-150 disabled:opacity-50"
                        >
                          {saving ? 'saving…' : 'save'}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-[11px] text-text-muted tracking-[0.04em] hover:text-text-primary transition-colors duration-150"
                        >
                          cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-[12px] text-text-primary tracking-[0.02em] truncate">
                        {item.title}
                      </p>
                      {item.description && (
                        <p className="text-[11px] text-text-muted tracking-[0.03em] mt-0.5 truncate">
                          {item.description}
                        </p>
                      )}
                      <div className="flex gap-3 mt-2">
                        <button
                          onClick={() => {
                            setEditingId(item.id)
                            setEditTitle(item.title)
                            setEditDescription(item.description ?? '')
                          }}
                          className="text-[11px] text-text-muted tracking-[0.04em] hover:text-text-primary transition-colors duration-150"
                        >
                          edit
                        </button>
                        <button
                          onClick={() => handleDelete(item.id, item.image_url)}
                          className="text-[11px] text-[#b84040] tracking-[0.04em] hover:text-[#d45050] transition-colors duration-150"
                        >
                          delete
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* order controls */}
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleMove(i, 'up')}
                    disabled={i === 0}
                    className="text-[11px] text-text-muted tracking-[0.04em] hover:text-text-primary transition-colors duration-150 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => handleMove(i, 'down')}
                    disabled={i === items.length - 1}
                    className="text-[11px] text-text-muted tracking-[0.04em] hover:text-text-primary transition-colors duration-150 disabled:opacity-30"
                  >
                    ↓
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
