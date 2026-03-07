import { auth } from '@/lib/auth'
import { notFound } from 'next/navigation'
import { getGalleryItems } from '@/lib/gallery'
import AdminGalleryClient from './AdminGalleryClient'

export const dynamic = 'force-dynamic'

export default async function AdminGalleryPage() {
  const session = await auth()
  if (!session) notFound()

  const items = await getGalleryItems()
  return <AdminGalleryClient initialItems={items} />
}
