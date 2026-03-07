import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { deletePost } from '@/lib/blog'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  try {
    await deletePost(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
