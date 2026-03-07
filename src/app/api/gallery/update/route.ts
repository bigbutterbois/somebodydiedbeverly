import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { updateGalleryItem } from '@/lib/gallery'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) return new NextResponse(null, { status: 404 })

  try {
    const { id, title, description } = await request.json()
    if (!id || !title?.trim()) {
      return NextResponse.json({ error: 'id and title required' }, { status: 400 })
    }

    const item = await updateGalleryItem(id, {
      title: title.trim(),
      description: description || null,
    })
    return NextResponse.json(item)
  } catch {
    return NextResponse.json({ error: 'update failed' }, { status: 500 })
  }
}
