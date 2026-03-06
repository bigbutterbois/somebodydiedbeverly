import Link from 'next/link'

export default function NavBar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-bg border-b border-border h-12 flex items-center px-6">
      <div className="flex items-center justify-between w-full max-w-page mx-auto">
        {/* site name — links home */}
        <Link
          href="/"
          className="text-sm text-ink tracking-tight hover:text-muted transition-colors duration-150"
        >
          somebody died beverly
        </Link>

        {/* section links */}
        <div className="flex items-center gap-6">
          <Link
            href="/blog"
            className="text-sm text-muted hover:text-ink transition-colors duration-150"
          >
            blog
          </Link>
          <Link
            href="/art"
            className="text-sm text-muted hover:text-ink transition-colors duration-150"
          >
            art
          </Link>
          <Link
            href="/diplomat"
            className="text-sm text-muted hover:text-ink transition-colors duration-150"
          >
            diplomat
          </Link>
        </div>
      </div>
    </nav>
  )
}
