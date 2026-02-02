'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Database } from '@/lib/types/database'
import { sanitizeUrl } from '@/lib/sanitize'

type Person = Database['public']['Tables']['saif_people']['Row'] & {
  companies?: Array<{
    id: string
    relationship_type: string
    title: string | null
    is_primary_contact: boolean
    end_date: string | null
    company: {
      id: string
      name: string
      logo_url: string | null
      stage: string
    } | null
  }>
}

interface PeopleGridProps {
  people: Person[]
  isPartner: boolean
}

type SortOption = 'name_asc' | 'name_desc'

export default function PeopleGrid({ people, isPartner }: PeopleGridProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<SortOption>('name_asc')

  // Filter people based on search and role
  const filteredPeople = people.filter((person) => {
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      const nameMatch = `${person.first_name} ${person.last_name}`.toLowerCase().includes(query)
      const titleMatch = person.title?.toLowerCase().includes(query)
      const bioMatch = person.bio?.toLowerCase().includes(query)
      const locationMatch = person.location?.toLowerCase().includes(query)
      const companyMatch = person.companies?.some(
        (c) => c.company?.name.toLowerCase().includes(query)
      )

      if (!nameMatch && !titleMatch && !bioMatch && !locationMatch && !companyMatch) {
        return false
      }
    }

    // Role filter
    if (roleFilter !== 'all' && person.role !== roleFilter) {
      return false
    }

    return true
  })

  // Sort people
  const sortedPeople = [...filteredPeople].sort((a, b) => {
    const nameA = `${a.first_name || ''} ${a.last_name || ''}`.toLowerCase()
    const nameB = `${b.first_name || ''} ${b.last_name || ''}`.toLowerCase()

    if (sortBy === 'name_asc') {
      return nameA.localeCompare(nameB)
    } else {
      return nameB.localeCompare(nameA)
    }
  })

  return (
    <div>
      {/* Search, Filter, and Sort Bar */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="Search by name, company, location..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
        >
          <option value="all">All Roles</option>
          <option value="founder">Founders</option>
          <option value="partner">Partners</option>
          {isPartner && (
            <>
              <option value="advisor">Advisors</option>
              <option value="employee">Employees</option>
              <option value="board_member">Board Members</option>
            </>
          )}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
        >
          <option value="name_asc">Name A-Z</option>
          <option value="name_desc">Name Z-A</option>
        </select>
      </div>

      {/* Results Count */}
      <div className="mb-4">
        <p className="text-sm text-gray-600">
          {sortedPeople.length === people.length
            ? `${people.length} ${people.length === 1 ? 'person' : 'people'}`
            : `${sortedPeople.length} of ${people.length} people`
          }
        </p>
      </div>

      {/* People Grid */}
      {sortedPeople.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No people match your search</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedPeople.map((person) => {
            // Get active companies
            const activeCompanies = person.companies?.filter(
              (c) => c.company && !c.end_date
            ) || []

            const primaryCompany = activeCompanies.find((c) => c.is_primary_contact)?.company ||
                                   activeCompanies[0]?.company

            return (
              <Link
                key={person.id}
                href={`/people/${person.id}`}
                className="block border border-gray-200 rounded-lg p-6 hover:border-gray-300 transition hover:shadow-md"
              >
                {/* Avatar and Basic Info */}
                <div className="flex items-start space-x-4 mb-4">
                  {person.avatar_url ? (
                    <img
                      src={person.avatar_url}
                      alt={`${person.first_name} ${person.last_name}`}
                      className="h-16 w-16 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                      <span className="text-xl font-semibold text-gray-500">
                        {person.first_name?.[0] || '?'}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                      {person.first_name} {person.last_name}
                    </h3>
                    {person.title && (
                      <p className="text-sm text-gray-600 truncate">{person.title}</p>
                    )}
                    <div className="mt-1 flex gap-2 flex-wrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        {person.role === 'board_member' ? 'Board Member' :
                         person.role.charAt(0).toUpperCase() + person.role.slice(1)}
                      </span>
                      {person.status === 'eligible' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          Eligible
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bio */}
                {person.bio && (
                  <p className="text-sm text-gray-700 mb-4 line-clamp-3">
                    {person.bio}
                  </p>
                )}

                {/* Company */}
                {primaryCompany && (
                  <div className="mb-4 flex items-center space-x-2">
                    {primaryCompany.logo_url ? (
                      <img
                        src={primaryCompany.logo_url}
                        alt={primaryCompany.name}
                        className="h-6 w-6 object-contain"
                      />
                    ) : (
                      <div className="h-6 w-6 bg-gray-100 rounded flex items-center justify-center">
                        <span className="text-xs font-bold text-gray-400">
                          {primaryCompany.name[0]}
                        </span>
                      </div>
                    )}
                    <span className="text-sm text-gray-900 truncate">
                      {primaryCompany.name}
                    </span>
                  </div>
                )}

                {/* Multiple Companies */}
                {activeCompanies.length > 1 && (
                  <p className="text-xs text-gray-500 mb-4">
                    +{activeCompanies.length - 1} more {activeCompanies.length - 1 === 1 ? 'company' : 'companies'}
                  </p>
                )}

                {/* Location */}
                {person.location && (
                  <p className="text-xs text-gray-500 mb-4">{person.location}</p>
                )}

                {/* Links */}
                <div className="flex gap-3 pt-4 border-t border-gray-200" onClick={(e) => e.stopPropagation()}>
                  {sanitizeUrl(person.linkedin_url) && (
                    <a
                      href={sanitizeUrl(person.linkedin_url)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gray-600 hover:text-gray-900 underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      LinkedIn
                    </a>
                  )}
                  {sanitizeUrl(person.twitter_url) && (
                    <a
                      href={sanitizeUrl(person.twitter_url)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gray-600 hover:text-gray-900 underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Twitter
                    </a>
                  )}
                  {person.email && (
                    <a
                      href={`mailto:${person.email}`}
                      className="text-xs text-gray-600 hover:text-gray-900 underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Email
                    </a>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
