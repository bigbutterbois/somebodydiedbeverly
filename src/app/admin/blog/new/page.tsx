import { auth } from '@/lib/auth'
import { notFound } from 'next/navigation'
import BlogEditorClient from '../BlogEditorClient'

export default async function NewPostPage() {
  const session = await auth()
  if (!session) notFound()

  return <BlogEditorClient />
}
