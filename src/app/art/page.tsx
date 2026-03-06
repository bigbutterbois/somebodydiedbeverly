import PageWrapper from '@/components/ui/PageWrapper'
import { artworks } from '@/data/artworks'
import ArtGallery from './ArtGallery'

export default function ArtPage() {
  return (
    <PageWrapper wide>
      <ArtGallery artworks={artworks} />
    </PageWrapper>
  )
}
