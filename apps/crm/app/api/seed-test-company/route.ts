import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  return handler()
}

export async function POST() {
  return handler()
}

async function handler() {
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
    return NextResponse.json({ error: 'Only partners can seed test data' }, { status: 403 })
  }

  try {
    // Create the company
    const { data: company, error: companyError } = await supabase
      .from('saif_companies')
      .insert({
        name: 'Quantum Gardens',
        short_description: 'AI-powered vertical farming for sustainable urban agriculture',
        website: 'https://quantumgardens.example.com',
        industry: 'AgTech / AI',
        founded_year: 2024,
        city: 'San Francisco',
        country: 'United States',
        stage: 'portfolio',
        is_active: true,
      })
      .select()
      .single()

    if (companyError) {
      console.error('Error creating company:', companyError)
      return NextResponse.json({ error: 'Failed to create company', details: companyError }, { status: 500 })
    }

    // Create founder 1 - Geoff (the one user will log in as)
    const { data: founder1, error: founder1Error } = await supabase
      .from('saif_people')
      .insert({
        first_name: 'Geoff',
        last_name: 'Thompson',
        email: 'geoff@yahoo.com',
        role: 'founder',
        status: 'tracked',
        title: 'Co-Founder & CEO',
        location: 'San Francisco, CA',
      })
      .select()
      .single()

    if (founder1Error) {
      console.error('Error creating founder 1:', founder1Error)
      return NextResponse.json({ error: 'Failed to create founder 1', details: founder1Error }, { status: 500 })
    }

    // Create founder 2
    const { data: founder2, error: founder2Error } = await supabase
      .from('saif_people')
      .insert({
        first_name: 'Maya',
        last_name: 'Chen',
        email: 'maya.chen@quantumgardens.example.com',
        role: 'founder',
        status: 'tracked',
        title: 'Co-Founder & CTO',
        location: 'Palo Alto, CA',
        bio: 'Former ML researcher at Stanford. Passionate about applying AI to solve climate challenges.',
      })
      .select()
      .single()

    if (founder2Error) {
      console.error('Error creating founder 2:', founder2Error)
      return NextResponse.json({ error: 'Failed to create founder 2', details: founder2Error }, { status: 500 })
    }

    // Link founders to company
    const { error: link1Error } = await supabase
      .from('saif_company_people')
      .insert({
        company_id: company.id,
        user_id: founder1.id,
        relationship_type: 'founder',
        title: 'Co-Founder & CEO',
        is_primary_contact: true,
      })

    if (link1Error) {
      console.error('Error linking founder 1:', link1Error)
      return NextResponse.json({ error: 'Failed to link founder 1', details: link1Error }, { status: 500 })
    }

    const { error: link2Error } = await supabase
      .from('saif_company_people')
      .insert({
        company_id: company.id,
        user_id: founder2.id,
        relationship_type: 'founder',
        title: 'Co-Founder & CTO',
        is_primary_contact: false,
      })

    if (link2Error) {
      console.error('Error linking founder 2:', link2Error)
      return NextResponse.json({ error: 'Failed to link founder 2', details: link2Error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      company: {
        id: company.id,
        name: company.name,
      },
      founders: [
        { name: `${founder1.first_name} ${founder1.last_name}`, email: founder1.email },
        { name: `${founder2.first_name} ${founder2.last_name}`, email: founder2.email },
      ],
      message: 'Test company created! Register/login with geoff@yahoo.com to test the founder flow.',
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
