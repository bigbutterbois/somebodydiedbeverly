import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { updateSighting } from '@/lib/diplomat-plates'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) return new NextResponse(null, { status: 404 })

  try {
    const { id, date_spotted, notes } = await request.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    await updateSighting(id, { date_spotted, notes: notes ?? null })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'update failed' }, { status: 500 })
  }
}
