import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { pathname } = req.nextUrl

  // admin routes return 404 for unauthenticated users — never redirect
  if (pathname.startsWith('/admin')) {
    if (!req.auth) {
      return new NextResponse(null, { status: 404 })
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/admin/:path*'],
}
