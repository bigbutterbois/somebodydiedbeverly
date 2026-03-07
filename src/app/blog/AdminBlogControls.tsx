'use client'

import Link from 'next/link'

export default function AdminBlogControls() {
  return (
    <Link
      href="/admin/blog/new"
      className="text-[10.5px] text-text-muted tracking-[0.08em] no-underline transition-colors duration-150 hover:text-accent"
    >
      + new post
    </Link>
  )
}
