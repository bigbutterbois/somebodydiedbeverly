import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { reorderGalleryItems } from '@/lib/gallery'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) return new NextResponse(null, { status: 404 })

  try {
    const { orderedIds } = await request.json()
    if (!Array.isArray(orderedIds)) {
      return NextResponse.json({ error: 'orderedIds required' }, { status: 400 })
    }

    await reorderGalleryItems(orderedIds)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'reorder failed' }, { status: 500 })
  }
}
