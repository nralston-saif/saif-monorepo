import { updateSession, type NextRequest } from '@saif/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request, {
    publicPaths: ['/auth', '/_next', '/api', '/'],
    loginPath: '/auth/login',
    defaultRedirect: '/dashboard',
  })
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
