import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function EditProfilePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: person } = await supabase
    .from('saif_people')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  if (!person) {
    redirect('/profile/claim')
  }

  // Redirect to the consolidated profile page
  redirect(`/people/${person.id}`)
}
