import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createPost, updatePost } from '@/lib/blog'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id, title, slug, content, published, password } = await req.json()

  if (!title?.trim() || !slug?.trim()) {
    return NextResponse.json({ error: 'title and slug are required' }, { status: 400 })
  }

  try {
    if (id) {
      await updatePost(id, { title, slug, content, published, password })
    } else {
      await createPost({ title, slug, content, published, password })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
