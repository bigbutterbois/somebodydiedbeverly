'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  slug: string
  title: string
}

export default function PasswordPrompt({ slug, title }: Props) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(false)
    setLoading(true)

    const res = await fetch('/api/blog/verify-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, password }),
    })

    setLoading(false)

    if (res.ok) {
      router.refresh()
    } else {
      setError(true)
    }
  }

  return (
    <main className="min-h-screen bg-charcoal flex items-center justify-center px-6">
      <div className="w-full max-w-[300px]">
        <span className="block text-[10.5px] text-text-muted tracking-[0.1em] mb-5">
          protected
        </span>
        <p className="text-[15px] font-normal text-text-primary leading-[1.45] tracking-[0.01em] mb-8">
          {title}
        </p>
        <form onSubmit={handleSubmit}>
          <div className="flex border border-border-dark overflow-hidden transition-colors focus-within:border-accent">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password"
              autoFocus
              className="flex-1 bg-[#1c1c1a] border-none outline-none text-text-primary font-sans text-[13px] tracking-[0.04em] px-[14px] py-[11px] placeholder:text-text-muted"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-transparent border-none border-l border-border-dark text-text-muted font-sans text-[11px] tracking-[0.06em] px-4 py-[11px] cursor-pointer transition-colors duration-150 hover:text-text-primary hover:bg-[#222220] disabled:opacity-50"
            >
              {loading ? '…' : 'enter'}
            </button>
          </div>
          <p
            className={`text-[11px] text-[#b84040] tracking-[0.03em] mt-3 transition-opacity duration-200 ${
              error ? 'opacity-100' : 'opacity-0'
            }`}
          >
            incorrect password
          </p>
        </form>
      </div>
    </main>
  )
}
