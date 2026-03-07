import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { deleteGalleryItem } from '@/lib/gallery'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) return new NextResponse(null, { status: 404 })

  try {
    const { id, imageUrl } = await request.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    await deleteGalleryItem(id, imageUrl)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'delete failed' }, { status: 500 })
  }
}
