import { notFound } from 'next/navigation'
import PageWrapper from '@/components/ui/PageWrapper'
import { getPostBySlug, blogPosts } from '@/data/blogPosts'
import HelloWorld from './posts/hello-world'
import OnDiplomats from './posts/on-diplomats'
import FirstPost from './posts/first-post'

const postComponents: Record<string, React.ComponentType> = {
  'hello-world': HelloWorld,
  'on-diplomats': OnDiplomats,
  'first-post': FirstPost,
}

export function generateStaticParams() {
  return blogPosts.map(post => ({ slug: post.slug }))
}

interface Props {
  params: Promise<{ slug: string }>
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const post = getPostBySlug(slug)

  if (!post) notFound()

  const Content = postComponents[slug]
  if (!Content) notFound()

  return (
    <PageWrapper>
      <article>
        <header className="mb-12">
          <h1 className="text-lg font-normal text-ink mb-2">{post.title}</h1>
          <time className="text-xs text-muted">{post.date}</time>
        </header>
        <div className="prose-custom">
          <Content />
        </div>
      </article>
    </PageWrapper>
  )
}
