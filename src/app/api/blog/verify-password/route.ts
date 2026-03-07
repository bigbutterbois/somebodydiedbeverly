import { NextRequest, NextResponse } from 'next/server'
import { getPost } from '@/lib/blog'

export async function POST(req: NextRequest) {
  const { slug, password } = await req.json()

  if (!slug || !password) {
    return NextResponse.json({ error: 'slug and password required' }, { status: 400 })
  }

  const post = await getPost(slug)
  if (!post) return NextResponse.json({ error: 'not found' }, { status: 404 })

  if (!post.password) return NextResponse.json({ error: 'not protected' }, { status: 400 })

  if (post.password !== password) {
    return NextResponse.json({ error: 'incorrect password' }, { status: 401 })
  }

  // set an httpOnly cookie granting access to this post
  const res = NextResponse.json({ ok: true })
  res.cookies.set(`post_access_${slug}`, '1', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })
  return res
}
