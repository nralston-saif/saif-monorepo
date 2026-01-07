import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { LOGIN_URL } from '@/lib/constants'

export async function POST(request: Request) {
  const supabase = await createClient()

  // Sign out the user
  const { error } = await supabase.auth.signOut()

  if (error) {
    console.error('Error signing out:', error)
    redirect('/dashboard')
  }

  // Revalidate the cache for the home page
  revalidatePath('/', 'layout')

  // Redirect to CRM login page
  redirect(LOGIN_URL)
}
