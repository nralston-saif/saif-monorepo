import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * Check if an email address has been confirmed in Supabase Auth.
 * Uses the service role client to bypass RLS.
 */
export async function checkEmailConfirmed(email: string): Promise<boolean> {
  const supabase = getServiceClient()

  const { data: authUsers, error } = await supabase.auth.admin.listUsers()

  if (error || !authUsers?.users) {
    console.error('Error checking email confirmation status:', error)
    return false
  }

  const user = authUsers.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  )

  return !!user?.email_confirmed_at
}
