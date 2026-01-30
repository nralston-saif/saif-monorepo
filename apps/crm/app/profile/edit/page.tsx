import { redirect } from 'next/navigation'
import { getActiveProfile } from '@/lib/impersonation'

export default async function EditProfilePage() {
  const { profile } = await getActiveProfile()

  if (!profile) {
    redirect('/login')
  }

  // Redirect to the consolidated profile page
  redirect(`/people/${profile.id}`)
}
