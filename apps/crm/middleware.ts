import { updateSession, NextResponse, type NextRequest } from '@saif/supabase/middleware'

export async function middleware(request: NextRequest) {
  // Skip authentication for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  return await updateSession(request, {
    publicPaths: ['/login', '/signup', '/auth', '/_next', '/api'],
    loginPath: '/login',
    defaultRedirect: '/dashboard',
  })
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
