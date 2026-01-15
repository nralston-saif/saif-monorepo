import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Simple in-memory rate limiter
// In production, consider using Redis/Upstash for distributed rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX = 30 // 30 requests per minute

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const record = rateLimitMap.get(ip)

  // Clean up old entries periodically (every 100 checks)
  if (Math.random() < 0.01) {
    for (const [key, value] of rateLimitMap.entries()) {
      if (now > value.resetTime) {
        rateLimitMap.delete(key)
      }
    }
  }

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 }
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 }
  }

  record.count++
  return { allowed: true, remaining: RATE_LIMIT_MAX - record.count }
}

// Sanitize input for use in Supabase/PostgREST filters
// Escapes special characters that could be used for injection
function sanitizeSearchQuery(input: string): string {
  return input
    .replace(/\\/g, '\\\\')  // Escape backslashes first
    .replace(/%/g, '\\%')    // Escape % wildcard
    .replace(/_/g, '\\_')    // Escape _ wildcard
    .replace(/,/g, '')       // Remove commas (filter separator)
    .replace(/\./g, '')      // Remove dots (operator separator)
    .replace(/\(/g, '')      // Remove parentheses
    .replace(/\)/g, '')
}

export async function GET(request: NextRequest) {
  // Rate limiting
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
             request.headers.get('x-real-ip') ||
             'unknown'
  const rateLimit = checkRateLimit(ip)

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': '60',
          'X-RateLimit-Remaining': '0',
        }
      }
    )
  }
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')

  if (!query || query.length < 2) {
    return NextResponse.json({ companies: [], people: [] })
  }

  // Sanitize the query to prevent filter injection
  const sanitizedQuery = sanitizeSearchQuery(query)

  const supabase = await createClient()

  // Search companies
  const { data: companies } = await supabase
    .from('saif_companies')
    .select('id, name, short_description, logo_url, industry')
    .or(`name.ilike.%${sanitizedQuery}%,short_description.ilike.%${sanitizedQuery}%`)
    .eq('is_active', true)
    .limit(10)

  // Search people
  const { data: people } = await supabase
    .from('saif_people')
    .select('id, name, first_name, last_name, email, role, title, avatar_url')
    .or(`first_name.ilike.%${sanitizedQuery}%,last_name.ilike.%${sanitizedQuery}%,name.ilike.%${sanitizedQuery}%,email.ilike.%${sanitizedQuery}%`)
    .in('status', ['active', 'pending'])
    .limit(10)

  return NextResponse.json(
    {
      companies: companies || [],
      people: people || [],
    },
    {
      headers: {
        'X-RateLimit-Remaining': String(rateLimit.remaining),
      }
    }
  )
}
