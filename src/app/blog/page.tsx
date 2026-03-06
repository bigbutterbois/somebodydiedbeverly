import Link from 'next/link'
import PageWrapper from '@/components/ui/PageWrapper'
import { blogPosts } from '@/data/blogPosts'

export default function BlogPage() {
  const sorted = [...blogPosts].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <PageWrapper>
      <div className="flex flex-col gap-6">
        {sorted.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="flex items-baseline justify-between gap-8 text-sm group no-underline"
          >
            <span className="text-muted whitespace-nowrap">{post.date}</span>
            <span className="text-ink group-hover:underline">{post.title}</span>
          </Link>
        ))}
      </div>
    </PageWrapper>
  )
}
