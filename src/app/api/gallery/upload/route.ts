import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createGalleryItem } from '@/lib/gallery'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) return new NextResponse(null, { status: 404 })

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const title = formData.get('title') as string | null
    const description = (formData.get('description') as string | null) || null

    if (!file || !title?.trim()) {
      return NextResponse.json({ error: 'file and title are required' }, { status: 400 })
    }

    const ext = file.name.split('.').pop() ?? 'jpg'
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const buffer = await file.arrayBuffer()

    const item = await createGalleryItem(buffer, filename, file.type, title.trim(), description)
    return NextResponse.json(item)
  } catch (err) {
    console.error('gallery upload error:', err)
    return NextResponse.json({ error: 'upload failed' }, { status: 500 })
  }
}
