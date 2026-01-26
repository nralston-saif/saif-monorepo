import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()

  // Check if user is authenticated and is a partner
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('saif_people')
    .select('role')
    .eq('auth_user_id', user.id)
    .single()

  if (profile?.role !== 'partner') {
    return NextResponse.json({ error: 'Only partners can publish companies' }, { status: 403 })
  }

  try {
    const { company_id, action } = await request.json()

    if (!company_id) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 })
    }

    // Get company details from saif_companies
    const { data: company, error: companyError } = await supabase
      .from('saif_companies')
      .select('id, name, short_description, logo_url, website')
      .eq('id', company_id)
      .single()

    if (companyError || !company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // Check if already published
    const { data: existing } = await supabase
      .from('website_portfolio_companies')
      .select('id')
      .eq('company_id', company_id)
      .single()

    // Determine if we should unpublish based on action and current state
    const shouldUnpublish = action === 'unpublish' || (action === 'toggle' && existing)

    if (shouldUnpublish) {
      // Unpublish - delete from website_portfolio_companies
      if (!existing) {
        // Already unpublished - return success for idempotency
        return NextResponse.json({
          success: true,
          published: false,
          message: `${company.name} is not on the website`,
        })
      }

      const { error: deleteError } = await supabase
        .from('website_portfolio_companies')
        .delete()
        .eq('company_id', company_id)

      if (deleteError) {
        console.error('Error unpublishing company:', deleteError)
        return NextResponse.json({ error: 'Failed to unpublish company' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        published: false,
        message: `${company.name} has been removed from the website`,
      })
    } else {
      // Publish - insert into website_portfolio_companies
      if (existing) {
        // Already published - return success for idempotency
        return NextResponse.json({
          success: true,
          published: true,
          message: `${company.name} is already on the website`,
        })
      }

      // Get the max sort_order
      const { data: maxOrder } = await supabase
        .from('website_portfolio_companies')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
        .single()

      const nextSortOrder = (maxOrder?.sort_order || 0) + 1

      const { error: insertError } = await supabase
        .from('website_portfolio_companies')
        .insert({
          company_id: company.id,
          name: company.name,
          tagline: company.short_description,
          logo_url: company.logo_url,
          website_url: company.website,
          sort_order: nextSortOrder,
          featured: false,
        })

      if (insertError) {
        console.error('Error publishing company:', insertError)
        return NextResponse.json({ error: 'Failed to publish company' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        published: true,
        message: `${company.name} has been published to the website`,
      })
    }
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}

// GET endpoint to check publish status for multiple companies
export async function GET(request: Request) {
  const supabase = await createClient()

  // Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const companyIds = searchParams.get('company_ids')?.split(',').filter(Boolean)

    if (!companyIds || companyIds.length === 0) {
      return NextResponse.json({ error: 'company_ids parameter is required' }, { status: 400 })
    }

    const { data: published, error } = await supabase
      .from('website_portfolio_companies')
      .select('company_id')
      .in('company_id', companyIds)

    if (error) {
      console.error('Error fetching published status:', error)
      return NextResponse.json({ error: 'Failed to fetch published status' }, { status: 500 })
    }

    const publishedIds = new Set(published?.map(p => p.company_id) || [])
    const result: Record<string, boolean> = {}
    companyIds.forEach(id => {
      result[id] = publishedIds.has(id)
    })

    return NextResponse.json({ published: result })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
