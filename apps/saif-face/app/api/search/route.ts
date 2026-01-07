import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')

  if (!query || query.length < 2) {
    return NextResponse.json({ companies: [], people: [] })
  }

  const supabase = await createClient()

  // Search companies
  const { data: companies } = await supabase
    .from('saif_companies')
    .select('id, name, short_description, logo_url, industry')
    .or(`name.ilike.%${query}%,short_description.ilike.%${query}%`)
    .eq('is_active', true)
    .limit(10)

  // Search people
  const { data: people } = await supabase
    .from('saif_people')
    .select('id, name, first_name, last_name, email, role, title, avatar_url')
    .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,name.ilike.%${query}%,email.ilike.%${query}%`)
    .in('status', ['active', 'pending'])
    .limit(10)

  return NextResponse.json({
    companies: companies || [],
    people: people || [],
  })
}
