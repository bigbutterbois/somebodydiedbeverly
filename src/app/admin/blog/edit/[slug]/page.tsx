import { auth } from '@/lib/auth'
import { notFound } from 'next/navigation'
import { getPost } from '@/lib/blog'
import BlogEditorClient from '../../BlogEditorClient'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function EditPostPage({ params }: Props) {
  const session = await auth()
  if (!session) notFound()

  const { slug } = await params
  const post = await getPost(slug)
  if (!post) notFound()

  return <BlogEditorClient post={post} />
}
