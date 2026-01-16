'use client'

import { useState, useMemo } from 'react'
import type { BioMapPerson, BioMapOrganization } from './page'
import BioMapDetailModal from './BioMapDetailModal'

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
  const [selectedOrganization, setSelectedOrganization] = useState<BioMapOrganization | null>(null)

  // Organization filters
  const [typeFilter, setTypeFilter] = useState<string>('all')

  // People filters
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [orgFilter, setOrgFilter] = useState<string>('all')
  const [locationFilter, setLocationFilter] = useState<string>('all')

  // Get unique values for filter dropdowns
  const uniqueTypes = useMemo(() => {
    const types = new Set<string>()
    organizations.forEach(org => {
      if (org.entity_type) types.add(org.entity_type)
    })
    return Array.from(types).sort()
  }, [organizations])

  const uniqueRoles = useMemo(() => {
    const roles = new Set<string>()
    people.forEach(p => {
      if (p.role) roles.add(p.role)
    })
    return Array.from(roles).sort()
  }, [people])

  const uniqueOrgs = useMemo(() => {
    const orgs = new Set<string>()
    people.forEach(p => {
      p.company_associations.forEach(ca => {
        if (ca.company?.name) orgs.add(ca.company.name)
      })
    })
    return Array.from(orgs).sort()
  }, [people])

  const uniqueLocations = useMemo(() => {
    const locations = new Set<string>()
    people.forEach(p => {
      if (p.location) locations.add(p.location)
    })
    return Array.from(locations).sort()
  }, [people])

  // Filter people
  const filteredPeople = useMemo(() => {
    let filtered = people

    // Apply tag filter
    if (selectedTag !== 'all') {
      filtered = filtered.filter(p =>
        p.tags.some(t => t.toLowerCase() === selectedTag.toLowerCase())
      )
    }

    // Apply role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(p => p.role === roleFilter)
    }

    // Apply organization filter
    if (orgFilter !== 'all') {
      filtered = filtered.filter(p =>
        p.company_associations.some(ca => ca.company?.name === orgFilter)
      )
    }

    // Apply location filter
    if (locationFilter !== 'all') {
      filtered = filtered.filter(p => p.location === locationFilter)
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
  }, [people, searchQuery, selectedTag, sortOption, roleFilter, orgFilter, locationFilter])

  // Filter organizations
  const filteredOrganizations = useMemo(() => {
    let filtered = organizations

    // Apply tag filter
    if (selectedTag !== 'all') {
      filtered = filtered.filter(o =>
        o.tags.some(t => t.toLowerCase() === selectedTag.toLowerCase())
      )
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(o => o.entity_type === typeFilter)
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
  }, [organizations, searchQuery, selectedTag, sortOption, typeFilter])

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

      {/* Search, Sort, View Mode and Tag Filters */}
      <div className="bg-white rounded-xl rounded-b-none shadow-sm border border-gray-100 border-b-0 p-4">
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('organizations')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                viewMode === 'organizations'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Organizations ({filteredOrganizations.length})
            </button>
            <button
              onClick={() => setViewMode('people')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                viewMode === 'people'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              People ({filteredPeople.length})
            </button>
          </div>
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

        {/* Filter dropdowns - different for organizations vs people */}
        <div className="flex flex-wrap gap-3">
          {viewMode === 'organizations' ? (
            // Organization filters
            <>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-gray-900 focus:border-gray-900"
              >
                <option value="all">All Types</option>
                {uniqueTypes.map(type => (
                  <option key={type} value={type}>
                    {ENTITY_TYPE_LABELS[type] || type}
                  </option>
                ))}
              </select>
              {bioTags.length > 0 && (
                <select
                  value={selectedTag}
                  onChange={(e) => setSelectedTag(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                >
                  <option value="all">All Focus</option>
                  {bioTags.map(tag => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              )}
            </>
          ) : (
            // People filters
            <>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-gray-900 focus:border-gray-900"
              >
                <option value="all">All Roles</option>
                {uniqueRoles.map(role => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role] || role}
                  </option>
                ))}
              </select>
              <select
                value={orgFilter}
                onChange={(e) => setOrgFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-gray-900 focus:border-gray-900"
              >
                <option value="all">All Organizations</option>
                {uniqueOrgs.map(org => (
                  <option key={org} value={org}>
                    {org}
                  </option>
                ))}
              </select>
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-gray-900 focus:border-gray-900"
              >
                <option value="all">All Locations</option>
                {uniqueLocations.map(loc => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
              {bioTags.length > 0 && (
                <select
                  value={selectedTag}
                  onChange={(e) => setSelectedTag(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                >
                  <option value="all">All Tags</option>
                  {bioTags.map(tag => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              )}
            </>
          )}
        </div>
      </div>

      {/* Content */}
      {viewMode === 'organizations' ? (
        /* Organizations Table */
        filteredOrganizations.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl rounded-t-none shadow-sm border border-gray-100">
            <span className="text-4xl mb-4 block">🧬</span>
            <p className="text-gray-500">No organizations found with bio-related tags</p>
            <p className="text-sm text-gray-400 mt-2">Add bio-related tags to organizations to see them here</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl rounded-t-none shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Organization</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Type</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600 hidden md:table-cell">Focus</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600 hidden lg:table-cell">Description</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600 hidden md:table-cell">Contact</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600 hidden lg:table-cell">Contact Info</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredOrganizations.map(org => (
                    <tr
                      key={org.id}
                      onClick={() => setSelectedOrganization(org)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{org.name}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {org.entity_type ? (ENTITY_TYPE_LABELS[org.entity_type] || org.entity_type) : '-'}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {getBioTags(org.tags).map(tag => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800"
                            >
                              {tag}
                            </span>
                          ))}
                          {getBioTags(org.tags).length === 0 && <span className="text-sm text-gray-400">-</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-sm text-gray-600 max-w-xs">
                        {org.short_description ? (
                          <span className="line-clamp-2">{org.short_description}</span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-sm text-gray-600">
                        {org.founders.length > 0 ? org.founders.map(f => f.name).join(', ') : '-'}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-sm text-gray-500">
                        {org.founders.length > 0 && org.founders[0].email ? (
                          <a
                            href={`mailto:${org.founders[0].email}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-blue-600 hover:underline"
                          >
                            {org.founders[0].email}
                          </a>
                        ) : '-'}
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
          <div className="text-center py-12 bg-white rounded-2xl rounded-t-none shadow-sm border border-gray-100">
            <span className="text-4xl mb-4 block">👥</span>
            <p className="text-gray-500">No people found with bio-related tags</p>
            <p className="text-sm text-gray-400 mt-2">Add bio-related tags to people to see them here</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl rounded-t-none shadow-sm border border-gray-100 overflow-hidden">
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
                      onClick={() => setSelectedPerson(person)}
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

      {/* Detail Modal */}
      {(selectedOrganization || selectedPerson) && (
        <BioMapDetailModal
          organization={selectedOrganization}
          person={selectedPerson}
          onClose={() => {
            setSelectedOrganization(null)
            setSelectedPerson(null)
          }}
        />
      )}
    </div>
  )
}
