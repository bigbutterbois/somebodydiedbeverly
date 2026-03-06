import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center relative px-6">
      <div className="flex flex-col items-center gap-8">
        <p className="text-sm text-ink m-0">
          somebody died beverly
        </p>
        <nav className="flex flex-col items-center gap-4">
          <Link href="/blog" className="text-sm text-muted no-underline hover:text-ink transition-colors duration-150">blog</Link>
          <Link href="/art" className="text-sm text-muted no-underline hover:text-ink transition-colors duration-150">art</Link>
          <Link href="/diplomat" className="text-sm text-muted no-underline hover:text-ink transition-colors duration-150">diplomat plate tracker</Link>
        </nav>
      </div>
      <Link
        href="/admin"
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-lg text-faint no-underline leading-none"
      >
        &middot;
      </Link>
    </main>
  )
}
