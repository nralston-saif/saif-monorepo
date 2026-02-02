import { createClient } from '@/lib/supabase/server'
import { getActiveProfile } from '@/lib/impersonation'
import StealthModeBanner from './StealthModeBanner'

/**
 * Server component wrapper that checks if the current user is a founder
 * of any company in stealth mode and shows the banner if so.
 */
export default async function StealthModeBannerWrapper() {
  const { profile } = await getActiveProfile()

  if (!profile) {
    return null
  }

  // Partners don't need to see the stealth banner - they can see everything anyway
  if (profile.role === 'partner') {
    return null
  }

  const supabase = await createClient()

  // Check if user is a founder of any stealth company
  const { data: stealthCompanies } = await supabase
    .from('saif_company_people')
    .select(`
      company:saif_companies!inner(
        id,
        name,
        is_stealth
      )
    `)
    .eq('user_id', profile.id)
    .eq('relationship_type', 'founder')
    .is('end_date', null)

  // Filter to only stealth companies
  const companiesInStealth = stealthCompanies
    ?.filter((cp: any) => cp.company?.is_stealth)
    ?.map((cp: any) => cp.company.name) || []

  if (companiesInStealth.length === 0) {
    return null
  }

  // Show banner with company name(s)
  const companyNames = companiesInStealth.length === 1
    ? companiesInStealth[0]
    : companiesInStealth.slice(0, -1).join(', ') + ' and ' + companiesInStealth[companiesInStealth.length - 1]

  return <StealthModeBanner companyName={companyNames} />
}
