'use client'

import { useState, FormEvent } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(false)
    setLoading(true)

    const result = await signIn('credentials', {
      username,
      password,
      redirect: false,
    })

    setLoading(false)

    if (result?.ok) {
      // activate admin mode on successful login
      if (typeof window !== 'undefined') {
        localStorage.setItem('sdb_admin_mode', 'true')
      }
      router.push('/')
      router.refresh()
    } else {
      setError(true)
    }
  }

  return (
    <main className="min-h-screen bg-charcoal flex items-center justify-center px-6">
      <div className="w-full max-w-[300px]">
        <span className="block text-[10.5px] text-text-muted tracking-[0.1em] mb-5">
          login
        </span>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div
            className="flex border border-border-dark overflow-hidden transition-colors focus-within:border-accent"
          >
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              autoComplete="username"
              className="flex-1 bg-[#1c1c1a] border-none outline-none text-text-primary font-sans text-[13px] tracking-[0.04em] px-[14px] py-[11px] placeholder:text-text-muted"
            />
          </div>

          <div
            className="flex border border-border-dark overflow-hidden transition-colors focus-within:border-accent"
          >
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password"
              autoComplete="current-password"
              className="flex-1 bg-[#1c1c1a] border-none outline-none text-text-primary font-sans text-[13px] tracking-[0.04em] px-[14px] py-[11px] placeholder:text-text-muted"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-none border border-border-dark text-text-muted font-sans text-[11px] tracking-[0.06em] py-[11px] px-4 cursor-pointer transition-colors hover:text-text-primary hover:bg-[#222220] disabled:opacity-50"
          >
            {loading ? 'logging in…' : 'enter'}
          </button>
        </form>

        <p
          className={`text-[11px] text-[#b84040] tracking-[0.03em] mt-3 transition-opacity duration-200 ${
            error ? 'opacity-100' : 'opacity-0'
          }`}
        >
          incorrect credentials
        </p>
      </div>
    </main>
  )
}
