import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center px-6">
      <div className="w-full max-w-[300px]">
        <span className="block text-[10.5px] text-text-muted tracking-[0.1em] mb-5">404</span>
        <p className="text-[15px] font-normal text-text-primary leading-[1.45] tracking-[0.01em] mb-8">
          nothing here
        </p>
        <Link
          href="/"
          className="text-[11px] text-text-muted tracking-[0.06em] no-underline transition-colors duration-150 hover:text-text-primary"
        >
          ← home
        </Link>
      </div>
    </div>
  )
}
