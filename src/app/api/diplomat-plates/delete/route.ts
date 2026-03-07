import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { deleteSighting } from '@/lib/diplomat-plates'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) return new NextResponse(null, { status: 404 })

  try {
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    await deleteSighting(id)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'delete failed' }, { status: 500 })
  }
}
