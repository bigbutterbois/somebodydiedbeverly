'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_LINKS = [
  { label: 'blog', href: '/blog' },
  { label: 'gallery', href: '/gallery' },
  { label: 'diplomat plates', href: '/diplomat-plates' },
]

export default function NavBar() {
  const pathname = usePathname()

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-nav-bg border-b border-border-dark h-nav flex items-center px-6 sm:px-10">
      <div className="flex items-center justify-between w-full">
        <Link
          href="/"
          className="text-[12.5px] text-text-primary tracking-[0.02em] no-underline transition-colors duration-150 hover:text-text-secondary"
        >
          somebody died beverly
        </Link>

        <div className="flex items-center gap-7">
          {NAV_LINKS.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href !== '/' && pathname.startsWith(link.href))

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-[11.5px] tracking-[0.04em] no-underline transition-colors duration-150 ${
                  isActive
                    ? 'text-accent'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {link.label}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
