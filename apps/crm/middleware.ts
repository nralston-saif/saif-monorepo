import { updateSession, NextResponse, type NextRequest } from '@saif/supabase/middleware'

// Generate a cryptographically secure nonce
function generateNonce(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Buffer.from(array).toString('base64')
}

// Build Content Security Policy header with nonce
function buildCSP(nonce: string): string {
  const directives = [
    "default-src 'self'",
    // Use nonce for scripts, with strict-dynamic for trusted chains
    // Keep unsafe-eval for now due to some Next.js requirements, but nonce provides better protection
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    // Keep unsafe-inline for styles (Tailwind requirement)
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https://dxllkeajdtbtvsjjoaxr.supabase.co",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://dxllkeajdtbtvsjjoaxr.supabase.co wss://dxllkeajdtbtvsjjoaxr.supabase.co https://*.liveblocks.io wss://*.liveblocks.io",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ]
  return directives.join('; ')
}

export async function middleware(request: NextRequest) {
  // Generate nonce for this request
  const nonce = generateNonce()

  // Skip authentication for API routes but still add CSP
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const response = NextResponse.next()
    // API routes don't need nonce but benefit from CSP
    response.headers.set('x-nonce', nonce)
    // Use Report-Only initially for testing - switch to Content-Security-Policy after validation
    response.headers.set('Content-Security-Policy-Report-Only', buildCSP(nonce))
    return response
  }

  const response = await updateSession(request, {
    publicPaths: ['/login', '/signup', '/auth', '/_next', '/api'],
    loginPath: '/login',
    defaultRedirect: '/dashboard',
  })

  // Add nonce header for use in layout
  response.headers.set('x-nonce', nonce)
  // Use Report-Only initially for testing - switch to Content-Security-Policy after validation
  response.headers.set('Content-Security-Policy-Report-Only', buildCSP(nonce))

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
