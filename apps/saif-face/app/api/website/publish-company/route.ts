import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Trigger revalidation on the website after publish/unpublish
async function revalidateWebsite() {
  const websiteUrl = process.env.WEBSITE_URL || 'https://saif-website.vercel.app'
  const revalidateSecret = process.env.WEBSITE_REVALIDATION_SECRET

  const pathsToRevalidate = ['/portfolio', '/']

  // Fire all revalidation requests in parallel for speed
  await Promise.allSettled(
    pathsToRevalidate.map(async (path) => {
      const url = new URL('/api/revalidate', websiteUrl)
      url.searchParams.set('path', path)
      if (revalidateSecret) {
        url.searchParams.set('secret', revalidateSecret)
      }
      return fetch(url.toString(), { method: 'POST' })
    })
  )
}

export async function POST(request: Request) {
  const supabase = await createClient()

  // Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Get current user's profile
  const { data: currentPerson } = await supabase
    .from('saif_people')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single()

  if (!currentPerson) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const isPartner = currentPerson.role === 'partner'

  try {
    const { company_id, action } = await request.json()

    if (!company_id) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 })
    }

    // If not a partner, check if user is a founder of THIS company
    if (!isPartner) {
      const { data: founderLink } = await supabase
        .from('saif_company_people')
        .select('id')
        .eq('company_id', company_id)
        .eq('user_id', currentPerson.id)
        .eq('relationship_type', 'founder')
        .is('end_date', null)
        .single()

      if (!founderLink) {
        return NextResponse.json({ error: 'Only founders can publish their own company' }, { status: 403 })
      }
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
    // Note: website_portfolio_companies is not in saif-face types, use type assertion
    const { data: existing } = await (supabase as any)
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

      const { error: deleteError } = await (supabase as any)
        .from('website_portfolio_companies')
        .delete()
        .eq('company_id', company_id)

      if (deleteError) {
        console.error('Error unpublishing company:', deleteError)
        return NextResponse.json({ error: 'Failed to unpublish company' }, { status: 500 })
      }

      // Trigger website revalidation
      await revalidateWebsite()

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
      const { data: maxOrder } = await (supabase as any)
        .from('website_portfolio_companies')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
        .single()

      const nextSortOrder = ((maxOrder as any)?.sort_order || 0) + 1

      const { error: insertError } = await (supabase as any)
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

      // Trigger website revalidation
      await revalidateWebsite()

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
