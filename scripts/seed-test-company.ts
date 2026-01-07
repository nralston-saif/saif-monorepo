import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function seedTestCompany() {
  console.log('Creating test company and founders...')

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
      is_AIsafety_company: false,
    })
    .select()
    .single()

  if (companyError) {
    console.error('Error creating company:', companyError)
    return
  }

  console.log('Created company:', company.name, company.id)

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
    return
  }

  console.log('Created founder 1:', founder1.first_name, founder1.last_name, founder1.id)

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
    return
  }

  console.log('Created founder 2:', founder2.first_name, founder2.last_name, founder2.id)

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
    return
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
    return
  }

  console.log('\n✓ Successfully created test company!')
  console.log('  Company: Quantum Gardens')
  console.log('  Founder 1: Geoff Thompson (geoff@yahoo.com) - CEO')
  console.log('  Founder 2: Maya Chen - CTO')
  console.log('\nYou can now register/login with geoff@yahoo.com to test the founder flow.')
}

seedTestCompany()
