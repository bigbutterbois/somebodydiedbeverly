import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { logSighting } from '@/lib/diplomat-plates'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) return new NextResponse(null, { status: 404 })

  try {
    const { country_id, date_spotted, notes } = await request.json()
    if (!country_id || !date_spotted) {
      return NextResponse.json({ error: 'country_id and date_spotted are required' }, { status: 400 })
    }

    const sighting = await logSighting({ country_id, date_spotted, notes: notes || null })
    return NextResponse.json(sighting)
  } catch (err) {
    console.error('log sighting error:', err)
    return NextResponse.json({ error: 'failed to log sighting' }, { status: 500 })
  }
}
