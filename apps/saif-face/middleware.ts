import { updateSession, type NextRequest } from '@saif/supabase/middleware'
import { LOGIN_URL } from '@/lib/constants'

export async function middleware(request: NextRequest) {
  return await updateSession(request, {
    publicPaths: ['/_next', '/api', '/'],
    loginPath: LOGIN_URL,
    defaultRedirect: '/dashboard',
  })
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
