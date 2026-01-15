import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

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

  return NextResponse.json({
    companies: companies || [],
    people: people || [],
  })
}
