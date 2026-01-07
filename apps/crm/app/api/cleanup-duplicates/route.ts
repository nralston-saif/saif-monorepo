import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication and partner role
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('saif_people')
      .select('role')
      .eq('auth_user_id', user.id)
      .single()

    if (!profile || profile.role !== 'partner') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Find all Quantum Gardens companies
    const { data: companies, error: compError } = await supabase
      .from('saif_companies')
      .select('id, name, created_at')
      .ilike('name', '%quantum%')

    if (compError) {
      return NextResponse.json({ error: 'Failed to fetch companies', details: compError }, { status: 500 })
    }

    // For each company, get the founders
    const companiesWithFounders = await Promise.all(
      (companies || []).map(async (company) => {
        const { data: relations } = await supabase
          .from('saif_company_people')
          .select(`
            relationship_type,
            person:saif_people(id, first_name, last_name, email)
          `)
          .eq('company_id', company.id)

        return {
          ...company,
          relations: relations || []
        }
      })
    )

    return NextResponse.json({
      message: 'Found Quantum Gardens companies',
      companies: companiesWithFounders
    })
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed', details: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication and partner role
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('saif_people')
      .select('role')
      .eq('auth_user_id', user.id)
      .single()

    if (!profile || profile.role !== 'partner') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { companyId } = await request.json()

    if (!companyId) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 })
    }

    // First delete any company_people relations
    const { error: relError } = await supabase
      .from('saif_company_people')
      .delete()
      .eq('company_id', companyId)

    if (relError) {
      return NextResponse.json({ error: 'Failed to delete relations', details: relError }, { status: 500 })
    }

    // Then delete the company
    const { error: compError } = await supabase
      .from('saif_companies')
      .delete()
      .eq('id', companyId)

    if (compError) {
      return NextResponse.json({ error: 'Failed to delete company', details: compError }, { status: 500 })
    }

    return NextResponse.json({ message: 'Company deleted successfully' })
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed', details: error.message }, { status: 500 })
  }
}
