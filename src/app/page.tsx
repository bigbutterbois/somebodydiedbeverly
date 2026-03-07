'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'
import { getAdminMode, toggleAdminMode } from '@/lib/admin-mode'

const NAV_LINKS = [
  { label: 'blog', href: '/blog' },
  { label: 'gallery', href: '/gallery' },
  { label: 'diplomat plates', href: '/diplomat-plates' },
]

export default function HomePage() {
  const { data: session } = useSession()
  const [adminMode, setAdminMode] = useState(false)

  useEffect(() => {
    setAdminMode(getAdminMode())
  }, [])

  function handleAdminSquare() {
    if (!session) {
      window.location.href = '/login'
      return
    }
    const next = toggleAdminMode()
    setAdminMode(next)
  }

  const squareStyle = session
    ? adminMode
      ? 'text-accent opacity-60'
      : 'text-text-muted opacity-35'
    : 'text-text-muted opacity-35'

  return (
    <main className="min-h-screen bg-charcoal flex flex-col items-center justify-center relative px-6">
      <div className="flex flex-col items-center gap-12">
        <p className="text-[16px] text-text-primary tracking-[0.04em] m-0">
          somebody died beverly
        </p>

        <nav className="flex flex-col w-[180px]">
          {NAV_LINKS.map((link, i) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center justify-between py-[13px] border-b border-border-dark no-underline group ${
                i === 0 ? 'border-t border-border-dark' : ''
              }`}
            >
              <span className="text-[12.5px] text-text-secondary tracking-[0.04em] transition-colors duration-150 group-hover:text-accent">
                {link.label}
              </span>
              <span className="text-[11px] text-text-muted transition-colors duration-150 group-hover:text-accent group-hover:translate-x-[3px] inline-block">
                →
              </span>
            </Link>
          ))}
        </nav>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
        <button
          onClick={handleAdminSquare}
          className={`w-[18px] h-[18px] border border-current cursor-pointer bg-transparent transition-colors duration-200 hover:opacity-100 ${squareStyle}`}
          aria-label="admin"
        />
      </div>
    </main>
  )
}
