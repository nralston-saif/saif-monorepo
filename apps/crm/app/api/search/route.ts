import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check auth
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get search query
    const url = new URL(request.url)
    const query = url.searchParams.get('q')?.trim()

    if (!query || query.length < 2) {
      return NextResponse.json({ applications: [], investments: [], people: [] })
    }

    // Search pattern for ilike
    const searchPattern = `%${query}%`

    // Search applications
    const { data: applications, error: appError } = await supabase
      .from('saifcrm_applications')
      .select('id, company_name, founder_names, company_description, stage, submitted_at')
      .or(`company_name.ilike.${searchPattern},founder_names.ilike.${searchPattern},company_description.ilike.${searchPattern}`)
      .order('submitted_at', { ascending: false })
      .limit(10)

    if (appError) {
      console.error('Error searching applications:', appError)
    }

    // Search investments
    const { data: investments, error: invError } = await supabase
      .from('saifcrm_investments')
      .select('id, company_name, founders, description, amount, investment_date')
      .or(`company_name.ilike.${searchPattern},founders.ilike.${searchPattern},description.ilike.${searchPattern}`)
      .order('investment_date', { ascending: false })
      .limit(10)

    if (invError) {
      console.error('Error searching investments:', invError)
    }

    // Search people - handle multi-word queries (e.g., "nick ralston")
    // Split query into words and search for each word, then filter results that match ALL words
    const searchWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 0)

    // Search for results matching the first word (or full query if single word)
    const firstWordPattern = `%${searchWords[0]}%`
    const { data: peopleRaw, error: peopleError } = await supabase
      .from('saif_people')
      .select('id, name, first_name, last_name, email, role, status, title, location')
      .or(`name.ilike.${firstWordPattern},first_name.ilike.${firstWordPattern},last_name.ilike.${firstWordPattern},email.ilike.${firstWordPattern},title.ilike.${firstWordPattern}`)
      .order('first_name', { ascending: true })
      .limit(50) // Fetch more to filter down

    if (peopleError) {
      console.error('Error searching people:', peopleError)
    }

    // Filter to only include results where ALL search words match somewhere
    const people = (peopleRaw || []).filter(person => {
      const searchableText = [
        person.name,
        person.first_name,
        person.last_name,
        person.email,
        person.title,
      ].filter(Boolean).join(' ').toLowerCase()

      return searchWords.every(word => searchableText.includes(word))
    }).slice(0, 10)

    return NextResponse.json({
      applications: applications || [],
      investments: investments || [],
      people: people || [],
    })
  } catch (error: any) {
    console.error('Search error:', error)
    return NextResponse.json(
      { error: 'Search failed', details: error.message },
      { status: 500 }
    )
  }
}
