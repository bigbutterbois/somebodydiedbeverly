import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getGalleryItems } from '@/lib/gallery'
import PageWrapper from '@/components/ui/PageWrapper'
import GalleryGrid from '@/components/gallery/GalleryGrid'

export const dynamic = 'force-dynamic'

export default async function GalleryPage() {
  const session = await auth()
  const items = await getGalleryItems()

  return (
    <PageWrapper variant="light" width="wide">
      <div className="flex items-baseline justify-between mb-12">
        <span className="text-[10.5px] tracking-[0.12em] text-accent">gallery</span>
        {session && (
          <Link
            href="/admin/gallery"
            className="text-[10.5px] text-light-muted tracking-[0.08em] no-underline transition-colors duration-150 hover:text-accent"
          >
            manage →
          </Link>
        )}
      </div>

      <GalleryGrid items={items} />
    </PageWrapper>
  )
}
