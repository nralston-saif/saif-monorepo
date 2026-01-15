'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { BioMapPerson, BioMapOrganization } from './page'

type ViewMode = 'people' | 'organizations'
type SortOption = 'name-az' | 'name-za' | 'date-newest'

const ROLE_COLORS: Record<string, string> = {
  partner: 'bg-blue-100 text-blue-800',
  founder: 'bg-purple-100 text-purple-800',
  advisor: 'bg-amber-100 text-amber-800',
  employee: 'bg-gray-100 text-gray-800',
  board_member: 'bg-emerald-100 text-emerald-800',
  investor: 'bg-indigo-100 text-indigo-800',
  contact: 'bg-slate-100 text-slate-800',
}

const ROLE_LABELS: Record<string, string> = {
  partner: 'Partner',
  founder: 'Founder',
  advisor: 'Advisor',
  employee: 'Employee',
  board_member: 'Board Member',
  investor: 'Investor',
  contact: 'Contact',
}

const ENTITY_TYPE_LABELS: Record<string, string> = {
  for_profit: 'For-Profit',
  pbc: 'Public Benefit Corp',
  nonprofit: 'Nonprofit',
  government: 'Government',
  other: 'Other',
}

export default function BioMapClient({
  people,
  organizations,
  bioTags,
  userId,
}: {
  people: BioMapPerson[]
  organizations: BioMapOrganization[]
  bioTags: string[]
  userId: string
}) {
  const [viewMode, setViewMode] = useState<ViewMode>('organizations')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState<string>('all')
  const [sortOption, setSortOption] = useState<SortOption>('name-az')
  const [selectedPerson, setSelectedPerson] = useState<BioMapPerson | null>(null)

  const router = useRouter()

  // Filter people
  const filteredPeople = useMemo(() => {
    let filtered = people

    // Apply tag filter
    if (selectedTag !== 'all') {
      filtered = filtered.filter(p =>
        p.tags.some(t => t.toLowerCase() === selectedTag.toLowerCase())
      )
    }

    // Apply search
    if (searchQuery.trim()) {
      const searchWords = searchQuery.toLowerCase().split(/\s+/).filter(w => w.length > 0)
      filtered = filtered.filter(person => {
        const searchableText = [
          person.displayName,
          person.email,
          person.title,
          person.bio,
          person.location,
          ...person.company_associations.map(ca => ca.company?.name),
          ...person.tags,
        ].filter(Boolean).join(' ').toLowerCase()

        return searchWords.every(word => searchableText.includes(word))
      })
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      switch (sortOption) {
        case 'name-az':
          return a.displayName.localeCompare(b.displayName)
        case 'name-za':
          return b.displayName.localeCompare(a.displayName)
        default:
          return 0
      }
    })

    return filtered
  }, [people, searchQuery, selectedTag, sortOption])

  // Filter organizations
  const filteredOrganizations = useMemo(() => {
    let filtered = organizations

    // Apply tag filter
    if (selectedTag !== 'all') {
      filtered = filtered.filter(o =>
        o.tags.some(t => t.toLowerCase() === selectedTag.toLowerCase())
      )
    }

    // Apply search
    if (searchQuery.trim()) {
      const searchWords = searchQuery.toLowerCase().split(/\s+/).filter(w => w.length > 0)
      filtered = filtered.filter(org => {
        const searchableText = [
          org.name,
          org.short_description,
          org.industry,
          org.city,
          org.country,
          ...org.founders.map(f => f.name),
          ...org.tags,
        ].filter(Boolean).join(' ').toLowerCase()

        return searchWords.every(word => searchableText.includes(word))
      })
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      switch (sortOption) {
        case 'name-az':
          return a.name.localeCompare(b.name)
        case 'name-za':
          return b.name.localeCompare(a.name)
        default:
          return 0
      }
    })

    return filtered
  }, [organizations, searchQuery, selectedTag, sortOption])

  // Get primary company for a person
  const getPrimaryCompany = (person: BioMapPerson): string | null => {
    if (person.company_associations.length === 0) return null
    return person.company_associations[0].company?.name || null
  }

  // Get bio tags for a person/org
  const getBioTags = (tags: string[]): string[] => {
    return tags.filter(t => t.toLowerCase().includes('bio'))
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Bio-Map</h1>
        <p className="mt-1 text-gray-500">
          Track organizations and people in the bio-safety space
        </p>
      </div>

      {/* View Mode Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-2 mb-6">
        <div className="flex gap-1">
          <button
            onClick={() => setViewMode('organizations')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              viewMode === 'organizations'
                ? 'bg-[#1a1a1a] text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Organizations ({filteredOrganizations.length})
          </button>
          <button
            onClick={() => setViewMode('people')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              viewMode === 'people'
                ? 'bg-[#1a1a1a] text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            People ({filteredPeople.length})
          </button>
        </div>
      </div>

      {/* Tag Filter Pills */}
      {bioTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setSelectedTag('all')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              selectedTag === 'all'
                ? 'bg-green-600 text-white'
                : 'bg-green-100 text-green-800 hover:bg-green-200'
            }`}
          >
            All Tags
          </button>
          {bioTags.map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                selectedTag === tag
                  ? 'bg-green-600 text-white'
                  : 'bg-green-100 text-green-800 hover:bg-green-200'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Search and Sort */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder={viewMode === 'organizations' ? 'Search organizations...' : 'Search people...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input !pl-11"
            />
          </div>
          <div className="sm:w-44">
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="input"
            >
              <option value="name-az">Name (A-Z)</option>
              <option value="name-za">Name (Z-A)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'organizations' ? (
        /* Organizations Table */
        filteredOrganizations.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-gray-100">
            <span className="text-4xl mb-4 block">🧬</span>
            <p className="text-gray-500">No organizations found with bio-related tags</p>
            <p className="text-sm text-gray-400 mt-2">Add bio-related tags to organizations to see them here</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-6 py-4 text-sm font-medium text-gray-600">Organization</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-gray-600 hidden md:table-cell">Description</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-gray-600 hidden lg:table-cell">Type</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-gray-600 hidden lg:table-cell">Location</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-gray-600 hidden xl:table-cell">Founders</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-gray-600">Tags</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredOrganizations.map(org => (
                    <tr
                      key={org.id}
                      onClick={() => router.push(`/companies/${org.id}`)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {org.logo_url ? (
                            <img
                              src={org.logo_url}
                              alt={org.name}
                              className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                              <span className="text-lg">🧬</span>
                            </div>
                          )}
                          <div className="font-medium text-gray-900">{org.name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell text-sm text-gray-600 max-w-md">
                        {org.short_description ? (
                          <span className="line-clamp-2">{org.short_description}</span>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 hidden lg:table-cell">
                        {org.entity_type && (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                            {ENTITY_TYPE_LABELS[org.entity_type] || org.entity_type}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 hidden lg:table-cell text-sm text-gray-500">
                        {[org.city, org.country].filter(Boolean).join(', ') || '-'}
                      </td>
                      <td className="px-6 py-4 hidden xl:table-cell text-sm text-gray-600">
                        {org.founders.length > 0 ? org.founders.map(f => f.name).join(', ') : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {getBioTags(org.tags).slice(0, 2).map(tag => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800"
                            >
                              {tag}
                            </span>
                          ))}
                          {getBioTags(org.tags).length > 2 && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                              +{getBioTags(org.tags).length - 2}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        /* People Table */
        filteredPeople.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-gray-100">
            <span className="text-4xl mb-4 block">👥</span>
            <p className="text-gray-500">No people found with bio-related tags</p>
            <p className="text-sm text-gray-400 mt-2">Add bio-related tags to people to see them here</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-6 py-4 text-sm font-medium text-gray-600">Name</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-gray-600 hidden md:table-cell">Role</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-gray-600 hidden lg:table-cell">Organization</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-gray-600 hidden lg:table-cell">Location</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-gray-600">Tags</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredPeople.map(person => (
                    <tr
                      key={person.id}
                      onClick={() => router.push(`/people/${person.id}`)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-[#1a1a1a] rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-sm font-medium">
                              {person.displayName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{person.displayName}</div>
                            {person.title && (
                              <div className="text-sm text-gray-500">{person.title}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${ROLE_COLORS[person.role] || 'bg-gray-100 text-gray-800'}`}>
                          {ROLE_LABELS[person.role] || person.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 hidden lg:table-cell text-sm text-gray-600">
                        {getPrimaryCompany(person) || '-'}
                      </td>
                      <td className="px-6 py-4 hidden lg:table-cell text-sm text-gray-500">
                        {person.location || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {getBioTags(person.tags).slice(0, 2).map(tag => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800"
                            >
                              {tag}
                            </span>
                          ))}
                          {getBioTags(person.tags).length > 2 && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                              +{getBioTags(person.tags).length - 2}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  )
}
