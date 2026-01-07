'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import SearchModal from '@/components/SearchModal'
import type { Database } from '@/lib/types/database'

type Person = Database['public']['Tables']['saif_people']['Row']

interface Company {
  id: string
  name: string
  short_description: string | null
  logo_url: string | null
  website: string | null
  industry: string | null
  city: string | null
  country: string | null
}

interface Founder {
  id: string
  first_name: string | null
  last_name: string | null
  title: string | null
}

interface FounderDashboardProps {
  person: Person
  userEmail: string
  company: Company | null
  founders: Founder[]
  founderTitle?: string | null
}

export default function FounderDashboard({ person, userEmail, company, founders, founderTitle }: FounderDashboardProps) {
  const [showSearch, setShowSearch] = useState(false)

  // Cmd+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearch(true)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-200 sticky top-0 z-40 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <Link href="/dashboard" className="text-xl font-bold text-gray-900">
                SAIFface
              </Link>
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
            </div>
            <div className="flex items-center space-x-4">
              {/* Search Button */}
              <button
                onClick={() => setShowSearch(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <span className="hidden sm:inline">Search</span>
                <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-xs text-gray-400 bg-gray-100 border border-gray-200 rounded">
                  ⌘K
                </kbd>
              </button>
              <div className="w-px h-6 bg-gray-200 hidden sm:block" />
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

      {/* Search Modal */}
      {showSearch && <SearchModal onClose={() => setShowSearch(false)} />}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section with Avatar */}
        <div className="mb-8 flex items-center space-x-6">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {person.avatar_url ? (
              <img
                src={person.avatar_url}
                alt={`${person.first_name} ${person.last_name}`}
                className="h-20 w-20 rounded-full object-cover border-2 border-gray-200"
              />
            ) : (
              <div className="h-20 w-20 rounded-full bg-gray-200 flex items-center justify-center border-2 border-gray-200">
                <span className="text-2xl font-semibold text-gray-500">
                  {person.first_name?.[0] || '?'}
                </span>
              </div>
            )}
          </div>

          {/* Welcome Text */}
          <div>
            <h2 className="text-3xl font-bold text-gray-900">
              Welcome back{person.first_name ? `, ${person.first_name}` : ''}
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              {founderTitle || (person.role.charAt(0).toUpperCase() + person.role.slice(1))}
              {company && <> at <Link href={`/companies/${company.id}`} className="font-medium text-gray-900 hover:underline">{company.name}</Link></>}
            </p>
          </div>
        </div>

        {/* Company Card */}
        {company && (
          <div className="mb-8 bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                {company.logo_url ? (
                  <img
                    src={company.logo_url}
                    alt={company.name}
                    className="h-16 w-16 object-contain rounded-lg border border-gray-200 p-1"
                  />
                ) : (
                  <div className="h-16 w-16 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
                    <span className="text-2xl font-bold text-gray-400">{company.name[0]}</span>
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{company.name}</h3>
                  {company.short_description && (
                    <p className="mt-1 text-sm text-gray-600 line-clamp-2">{company.short_description}</p>
                  )}
                  {founders.length > 0 && (
                    <p className="mt-2 text-sm text-gray-700">
                      <span className="text-gray-500">Founders:</span>{' '}
                      {founders.map((f, idx) => (
                        <span key={f.id}>
                          {idx > 0 && ', '}
                          <Link href={`/people/${f.id}`} className="hover:underline">
                            {f.first_name} {f.last_name}
                          </Link>
                        </span>
                      ))}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                    {company.industry && <span>{company.industry}</span>}
                    {company.city && company.country && (
                      <span>• {company.city}, {company.country}</span>
                    )}
                  </div>
                </div>
              </div>
              <Link
                href={`/companies/${company.id}`}
                className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800"
              >
                View Company
              </Link>
            </div>
          </div>
        )}

        {/* Profile Completion Prompt */}
        {(!person.bio || !person.avatar_url) && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold text-blue-900">Complete your profile</h3>
            <p className="mt-2 text-sm text-blue-700">
              {!person.bio && !person.avatar_url
                ? 'Add your photo and bio to help others in the SAIF community get to know you.'
                : !person.bio
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
              href="/people"
              className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            >
              <div>
                <h4 className="text-sm font-medium text-gray-900">SAIF People</h4>
                <p className="mt-1 text-sm text-gray-500">
                  Connect with founders and partners
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

            {company && (
              <Link
                href={`/companies/${company.id}`}
                className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
              >
                <div>
                  <h4 className="text-sm font-medium text-gray-900">View Company</h4>
                  <p className="mt-1 text-sm text-gray-500">
                    See {company.name}'s full profile
                  </p>
                </div>
              </Link>
            )}
          </div>
        </div>

      </main>
    </div>
  )
}
