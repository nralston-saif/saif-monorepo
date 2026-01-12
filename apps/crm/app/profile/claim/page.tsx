'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/types/database'

type Person = Database['public']['Tables']['saif_people']['Row']

export default function ClaimProfilePage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [searchName, setSearchName] = useState('')
  const [matchingProfiles, setMatchingProfiles] = useState<Person[]>([])
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Check if user already has a profile
  useEffect(() => {
    async function checkExistingProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          router.push('/auth/login')
          return
        }

        setUserEmail(user.email || null)

        // Check if user already has a profile linked
        const { data: existingProfile } = await supabase
          .from('saif_people')
          .select('*')
          .eq('auth_user_id', user.id)
          .single()

        if (existingProfile) {
          // Already has profile, go to dashboard
          router.push('/dashboard')
          return
        }

        // Search for profiles matching user's email
        if (user.email) {
          const { data: emailMatches, error: searchError } = await supabase
            .from('saif_people')
            .select('*')
            .eq('email', user.email)
            .is('auth_user_id', null)

          if (searchError) {
            console.error('Error searching profiles:', searchError)
          } else if (emailMatches && emailMatches.length > 0) {
            setMatchingProfiles(emailMatches as Person[])
          }
        }

        setLoading(false)
      } catch (err) {
        console.error('Error checking profile:', err)
        setError('An error occurred. Please try again.')
        setLoading(false)
      }
    }

    checkExistingProfile()
  }, [router, supabase])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!searchName.trim()) {
      return
    }

    setLoading(true)

    try {
      // Split search into potential first/last name
      const nameParts = searchName.trim().split(/\s+/)
      const firstName = nameParts[0]
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null

      // Search for matching profiles (unclaimed only)
      let query = supabase
        .from('saif_people')
        .select('*')
        .is('auth_user_id', null)

      // Search by first name (case insensitive)
      if (lastName) {
        query = query
          .ilike('first_name', firstName)
          .ilike('last_name', lastName)
      } else {
        query = query.or(`first_name.ilike.${firstName},last_name.ilike.${firstName}`)
      }

      const { data, error: searchError } = await query.limit(10)

      if (searchError) {
        setError('Error searching profiles. Please try again.')
        console.error(searchError)
      } else {
        setMatchingProfiles((data as Person[]) || [])
        if (!data || data.length === 0) {
          setError('No matching profiles found. Please try a different name or contact SAIF support.')
        }
      }
    } catch (err) {
      console.error('Search error:', err)
      setError('An error occurred during search.')
    } finally {
      setLoading(false)
    }
  }

  const handleClaimProfile = async (profileId: string) => {
    setClaiming(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/auth/login')
        return
      }

      // Simple update to claim the profile
      const { error: updateError } = await supabase
        .from('saif_people')
        .update({
          auth_user_id: user.id,
          email: user.email,
          status: 'active'
        })
        .eq('id', profileId)
        .is('auth_user_id', null) // Only claim if unclaimed

      if (updateError) {
        console.error('Claim error:', updateError)
        setError('An error occurred while claiming the profile. Please try again.')
        setClaiming(false)
        return
      }

      // Success! Redirect to profile page
      router.push(`/people/${profileId}`)
    } catch (err) {
      console.error('Error claiming profile:', err)
      setError('An error occurred. Please try again.')
      setClaiming(false)
    }
  }

  const handleCreateNew = () => {
    // For now, show error - we'll implement manual profile creation later
    setError('Please contact SAIF support to create a new profile.')
  }

  if (loading && matchingProfiles.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Claim Your Profile</h1>
          <p className="mt-2 text-sm text-gray-600">
            {userEmail ? `Signed in as: ${userEmail}` : 'Find and claim your existing profile'}
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Email matches section */}
        {matchingProfiles.length > 0 ? (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {matchingProfiles.length === 1 ? 'Is this you?' : 'Found matching profiles'}
            </h2>
            <div className="space-y-4">
              {matchingProfiles.map((profile) => (
                <div
                  key={profile.id}
                  className="border border-gray-200 rounded-lg p-6 hover:border-gray-300 transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {profile.first_name} {profile.last_name}
                      </h3>
                      {profile.email && (
                        <p className="text-sm text-gray-600 mt-1">{profile.email}</p>
                      )}
                      {profile.title && (
                        <p className="text-sm text-gray-500 mt-1">{profile.title}</p>
                      )}
                      {profile.location && (
                        <p className="text-sm text-gray-500 mt-1">{profile.location}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-2">
                        Role: {profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleClaimProfile(profile.id)}
                      disabled={claiming}
                      className="ml-4 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {claiming ? 'Claiming...' : 'Claim Profile'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mb-8 text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              No profiles found matching your email. Search by name below.
            </p>
          </div>
        )}

        {/* Search section */}
        <div className="border-t border-gray-200 pt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Search by Name</h2>
          <form onSubmit={handleSearch} className="flex gap-4">
            <input
              type="text"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              placeholder="Enter your full name"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
            />
            <button
              type="submit"
              disabled={loading || !searchName.trim()}
              className="px-6 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </form>
          <p className="mt-2 text-xs text-gray-500">
            Enter your name as it appears in SAIF records
          </p>
        </div>

        {/* Can't find profile */}
        <div className="mt-12 text-center pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-600 mb-4">
            Can't find your profile?
          </p>
          <button
            onClick={handleCreateNew}
            className="text-sm font-medium text-gray-900 hover:text-gray-700"
          >
            Contact SAIF Support
          </button>
        </div>
      </div>
    </div>
  )
}
