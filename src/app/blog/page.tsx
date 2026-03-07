import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getPosts, getAllPosts } from '@/lib/blog'
import PageWrapper from '@/components/ui/PageWrapper'
import AdminBlogControls from './AdminBlogControls'

export const dynamic = 'force-dynamic'

export default async function BlogPage() {
  const session = await auth()
  const posts = session ? await getAllPosts() : await getPosts()

  return (
    <PageWrapper variant="light" width="blog">
      <div className="flex items-baseline justify-between mb-9">
        <span className="text-[10.5px] tracking-[0.12em] text-accent">blog</span>
        {session && <AdminBlogControls />}
      </div>

      <div className="flex flex-col">
        {posts.map((post, i) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className={`flex items-baseline justify-between gap-6 py-4 border-b border-border-light no-underline group ${
              i === 0 ? 'border-t border-border-light' : ''
            }`}
          >
            <span className="text-[13.5px] text-light-primary tracking-[0.01em] leading-[1.4] flex-1 transition-colors duration-150 group-hover:text-accent">
              {post.title}
              {session && !post.published && (
                <span className="ml-2 text-[10px] text-light-muted tracking-[0.06em]">
                  draft
                </span>
              )}
            </span>
            <div className="flex items-center gap-[10px] flex-shrink-0">
              <span className="text-[11px] text-light-muted tracking-[0.03em]">
                {post.created_at.slice(0, 10)}
              </span>
              {post.password && (
                <span className="text-[9.5px] text-light-muted opacity-55">🔒</span>
              )}
            </div>
          </Link>
        ))}

        {posts.length === 0 && (
          <p className="text-[13px] text-light-muted tracking-[0.02em] py-8">
            no posts yet
          </p>
        )}
      </div>
    </PageWrapper>
  )
}
