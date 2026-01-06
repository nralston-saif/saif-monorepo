import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/types/database'
import Link from 'next/link'

type Person = Database['public']['Tables']['saif_people']['Row']

export default async function DashboardPage() {
  const supabase = await createClient()

  // Get current user session
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/auth/login')
  }

  // Fetch user's profile from saif_people
  const { data: person, error: personError } = await supabase
    .from('saif_people')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  if (personError || !person) {
    // User is authenticated but doesn't have a profile yet
    // Redirect to profile claiming flow
    redirect('/profile/claim')
  }

  const typedPerson = person as Person

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">SAIFface</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/companies"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Companies
              </Link>
              <Link
                href="/people"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                People
              </Link>
              <Link
                href="/profile/edit"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Profile
              </Link>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section with Avatar */}
        <div className="mb-8 flex items-center space-x-6">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {typedPerson.avatar_url ? (
              <img
                src={typedPerson.avatar_url}
                alt={`${typedPerson.first_name} ${typedPerson.last_name}`}
                className="h-20 w-20 rounded-full object-cover border-2 border-gray-200"
              />
            ) : (
              <div className="h-20 w-20 rounded-full bg-gray-200 flex items-center justify-center border-2 border-gray-200">
                <span className="text-2xl font-semibold text-gray-500">
                  {typedPerson.first_name?.[0] || '?'}
                </span>
              </div>
            )}
          </div>

          {/* Welcome Text */}
          <div>
            <h2 className="text-3xl font-bold text-gray-900">
              Welcome back{typedPerson.first_name ? `, ${typedPerson.first_name}` : ''}
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              {typedPerson.role === 'partner'
                ? 'SAIF Partner'
                : `${typedPerson.role.charAt(0).toUpperCase() + typedPerson.role.slice(1)} • ${typedPerson.status}`
              }
            </p>
          </div>
        </div>

        {/* Quick Stats / Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-sm font-medium text-gray-500 uppercase">Status</h3>
            <p className="mt-2 text-2xl font-semibold text-gray-900">
              {typedPerson.status === 'active' ? 'Active' : typedPerson.status.charAt(0).toUpperCase() + typedPerson.status.slice(1)}
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-sm font-medium text-gray-500 uppercase">Role</h3>
            <p className="mt-2 text-2xl font-semibold text-gray-900">
              {typedPerson.role === 'board_member'
                ? 'Board Member'
                : typedPerson.role.split('_').map(word =>
                    word.charAt(0).toUpperCase() + word.slice(1)
                  ).join(' ')
              }
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-sm font-medium text-gray-500 uppercase">Profile</h3>
            <p className="mt-2 text-2xl font-semibold text-gray-900">
              {typedPerson.first_name && typedPerson.last_name && typedPerson.bio ? 'Complete' : 'Incomplete'}
            </p>
          </div>
        </div>

        {/* Profile Completion Prompt */}
        {(!typedPerson.bio || !typedPerson.avatar_url) && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold text-blue-900">Complete your profile</h3>
            <p className="mt-2 text-sm text-blue-700">
              {!typedPerson.bio && !typedPerson.avatar_url
                ? 'Add your photo and bio to help others in the SAIF community get to know you.'
                : !typedPerson.bio
                ? 'Add a bio to help others in the SAIF community get to know you.'
                : 'Add your photo to complete your profile.'
              }
            </p>
            <Link
              href="/profile/edit"
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Complete Profile
            </Link>
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href="/companies"
              className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            >
              <div>
                <h4 className="text-sm font-medium text-gray-900">Browse Portfolio</h4>
                <p className="mt-1 text-sm text-gray-500">
                  Discover companies in the SAIF portfolio
                </p>
              </div>
            </Link>

            <Link
              href="/profile/edit"
              className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            >
              <div>
                <h4 className="text-sm font-medium text-gray-900">Edit Profile</h4>
                <p className="mt-1 text-sm text-gray-500">
                  Update your information and photo
                </p>
              </div>
            </Link>

            {typedPerson.role === 'partner' && (
              <>
                <Link
                  href="/admin/companies"
                  className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                >
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">Manage Companies</h4>
                    <p className="mt-1 text-sm text-gray-500">
                      Add and edit portfolio companies
                    </p>
                  </div>
                </Link>

                <Link
                  href="/admin/people"
                  className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                >
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">Manage People</h4>
                    <p className="mt-1 text-sm text-gray-500">
                      Invite and manage community members
                    </p>
                  </div>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Profile Details Section */}
        <div className="mt-8 bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Profile</h3>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-500">Name</h4>
              <p className="mt-1 text-sm text-gray-900">
                {typedPerson.first_name && typedPerson.last_name
                  ? `${typedPerson.first_name} ${typedPerson.last_name}`
                  : typedPerson.first_name || typedPerson.last_name || 'Not set'
                }
              </p>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-500">Email</h4>
              <p className="mt-1 text-sm text-gray-900">{typedPerson.email || user.email}</p>
            </div>

            {typedPerson.title && (
              <div>
                <h4 className="text-sm font-medium text-gray-500">Title</h4>
                <p className="mt-1 text-sm text-gray-900">{typedPerson.title}</p>
              </div>
            )}

            {typedPerson.bio && (
              <div>
                <h4 className="text-sm font-medium text-gray-500">Bio</h4>
                <p className="mt-1 text-sm text-gray-900">{typedPerson.bio}</p>
              </div>
            )}

            {typedPerson.location && (
              <div>
                <h4 className="text-sm font-medium text-gray-500">Location</h4>
                <p className="mt-1 text-sm text-gray-900">{typedPerson.location}</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
