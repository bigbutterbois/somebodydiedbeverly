import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { auth } from '@/lib/auth'
import { getPost } from '@/lib/blog'
import NavBar from '@/components/ui/NavBar'
import PasswordPrompt from './PasswordPrompt'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const post = await getPost(slug)

  if (!post) notFound()

  const session = await auth()

  // if not published and not admin, 404
  if (!post.published && !session) notFound()

  // password check — admin bypasses
  if (post.password && !session) {
    const cookieStore = await cookies()
    const accessCookie = cookieStore.get(`post_access_${slug}`)
    if (!accessCookie) {
      return <PasswordPrompt slug={slug} title={post.title} />
    }
  }

  return (
    <div className="min-h-screen bg-charcoal">
      <NavBar />
      <main className="max-w-post mx-auto px-6 sm:px-10 pt-[60px] pb-[100px] w-full">
        <article>
          <span className="block text-[10.5px] text-text-muted tracking-[0.08em] mb-[18px]">
            {post.created_at.slice(0, 10)}
          </span>
          <h1 className="text-[20px] font-normal text-text-primary tracking-[0.01em] leading-[1.4] mb-[48px] pb-8 border-b border-border-dark">
            {post.title}
          </h1>
          <div
            className="prose-post"
            dangerouslySetInnerHTML={{ __html: post.content ?? '' }}
          />
        </article>

        {session && (
          <div className="mt-16 pt-6 border-t border-border-dark">
            <Link
              href={`/admin/blog/edit/${slug}`}
              className="text-[10.5px] text-text-muted tracking-[0.08em] no-underline hover:text-accent transition-colors duration-150"
            >
              edit post
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
