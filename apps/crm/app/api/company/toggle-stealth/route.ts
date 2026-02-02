import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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
    const { company_id } = await request.json()

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
        return NextResponse.json({ error: 'Only founders can toggle stealth mode for their company' }, { status: 403 })
      }
    }

    // Get company details (including current stealth status)
    const { data: company, error: companyError } = await supabase
      .from('saif_companies')
      .select('id, name, is_stealth, stage')
      .eq('id', company_id)
      .single()

    if (companyError || !company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // Only portfolio companies can use stealth mode
    if (company.stage !== 'portfolio') {
      return NextResponse.json({ error: 'Stealth mode is only available for portfolio companies' }, { status: 400 })
    }

    // Toggle the stealth status
    const newStealthStatus = !company.is_stealth

    const { error: updateError } = await supabase
      .from('saif_companies')
      .update({
        is_stealth: newStealthStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', company_id)

    if (updateError) {
      console.error('Error updating stealth status:', updateError)
      return NextResponse.json({ error: 'Failed to update stealth status' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      is_stealth: newStealthStatus,
      message: newStealthStatus
        ? `${company.name} is now in stealth mode`
        : `${company.name} is now visible to the community`,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
