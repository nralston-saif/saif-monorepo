'use client'

import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useToast } from '@saif/ui'
import PersonMeetingNotes from '@/components/PersonMeetingNotes'
import type { UserRole, UserStatus, RelationshipType } from '@saif/supabase'

type CompanyAssociation = {
  relationship_type: string
  title: string | null
  company: {
    id: string
    name: string
  } | null
}

type Person = {
  id: string
  name: string | null
  first_name: string | null
  last_name: string | null
  displayName: string | null
  email: string | null
  role: UserRole
  status: UserStatus
  title: string | null
  bio: string | null
  linkedin_url: string | null
  twitter_url: string | null
  mobile_phone: string | null
  location: string | null
  first_met_date: string | null
  introduced_by: string | null
  introduction_context: string | null
  relationship_notes: string | null
  created_at: string
  company_associations: CompanyAssociation[]
  noteCount: number
}

type RoleFilter = 'all' | UserRole
type SortOption = 'name-az' | 'name-za' | 'role' | 'date-newest' | 'date-oldest'

const ROLE_LABELS: Record<string, string> = {
  partner: 'Partner',
  founder: 'Founder',
  advisor: 'Advisor',
  employee: 'Employee',
  board_member: 'Board Member',
  investor: 'Investor',
  contact: 'Contact',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  pending: 'Pending',
  tracked: 'Tracked',
  inactive: 'Inactive',
}

const ROLE_COLORS: Record<string, string> = {
  partner: 'bg-blue-100 text-blue-800',
  founder: 'bg-purple-100 text-purple-800',
  advisor: 'bg-amber-100 text-amber-800',
  employee: 'bg-gray-100 text-gray-800',
  board_member: 'bg-emerald-100 text-emerald-800',
  investor: 'bg-indigo-100 text-indigo-800',
  contact: 'bg-slate-100 text-slate-800',
}

type CompanyLocation = {
  page: string
  id: string
}

export default function PeopleClient({
  people,
  userId,
  userName,
  companyLocationMap,
  initialSearch = '',
}: {
  people: Person[]
  userId: string
  userName: string
  companyLocationMap: Record<string, CompanyLocation>
  initialSearch?: string
}) {
  // Use both server-provided initialSearch AND client-side URL params
  const searchParams = useSearchParams()
  const urlSearch = searchParams.get('search') || ''

  const [searchQuery, setSearchQuery] = useState(initialSearch || urlSearch)
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortOption, setSortOption] = useState<SortOption>('name-az')
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
  const [notesPersonId, setNotesPersonId] = useState<Person | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [formData, setFormData] = useState<Partial<Person>>({})
  const [loading, setLoading] = useState(false)
  const [potentialDuplicates, setPotentialDuplicates] = useState<Person[]>([])
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false)
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('')
  const [relationshipType, setRelationshipType] = useState<string>('employee')

  const router = useRouter()
  const supabase = createClient()
  const { showToast } = useToast()

  // Fetch companies for the dropdown
  useEffect(() => {
    const fetchCompanies = async () => {
      const { data } = await supabase
        .from('saif_companies')
        .select('id, name')
        .order('name')

      if (data) {
        setCompanies(data)
      }
    }
    fetchCompanies()
  }, [supabase])

  // Sync URL search param to state (handles client-side navigation)
  useEffect(() => {
    const newSearch = urlSearch || initialSearch
    if (newSearch !== searchQuery) {
      setSearchQuery(newSearch)
    }
  }, [urlSearch, initialSearch])

  // Filter and search people
  const filteredPeople = useMemo(() => {
    let filtered = people

    // Apply search filter - support multi-word search (all words must match)
    if (searchQuery.trim()) {
      const searchWords = searchQuery.toLowerCase().split(/\s+/).filter(w => w.length > 0)

      filtered = filtered.filter(person => {
        // Build searchable text from all fields
        const searchableText = [
          person.displayName,
          person.first_name,
          person.last_name,
          person.name,
          person.email,
          person.title,
          person.bio,
          ...person.company_associations.map(ca => ca.company?.name),
        ].filter(Boolean).join(' ').toLowerCase()

        // All search words must be found
        return searchWords.every(word => searchableText.includes(word))
      })
    }

    // Apply role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(person => person.role === roleFilter)
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(person => person.status === statusFilter)
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      switch (sortOption) {
        case 'name-az':
          return (a.displayName || '').localeCompare(b.displayName || '')
        case 'name-za':
          return (b.displayName || '').localeCompare(a.displayName || '')
        case 'role':
          return (a.role || '').localeCompare(b.role || '')
        case 'date-newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'date-oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        default:
          return 0
      }
    })

    return filtered
  }, [people, searchQuery, roleFilter, statusFilter, sortOption])

  // Calculate role counts
  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = { all: people.length }
    people.forEach(person => {
      counts[person.role] = (counts[person.role] || 0) + 1
    })
    return counts
  }, [people])

  const openAddModal = () => {
    setFormData({
      name: '',
      email: '',
      role: 'contact',
      status: 'tracked',
      title: '',
      bio: '',
      linkedin_url: '',
      twitter_url: '',
      mobile_phone: '',
      location: '',
    })
    setSelectedCompanyId('')
    setRelationshipType('employee')
    setShowAddModal(true)
  }

  const openEditModal = (person: Person) => {
    setFormData(person)
    setShowAddModal(true)
    setSelectedPerson(null)
  }

  // Check for potential duplicates based on name similarity
  const checkForDuplicates = (name: string, email: string | null): Person[] => {
    const nameLower = name.toLowerCase().trim()
    const nameWords = nameLower.split(/\s+/).filter(w => w.length > 0)

    return people.filter(person => {
      // Check for exact email match (if email provided)
      if (email && person.email && email.toLowerCase() === person.email.toLowerCase()) {
        return true
      }

      // Check for similar names
      const personName = (person.name || person.displayName || `${person.first_name || ''} ${person.last_name || ''}`).toLowerCase().trim()
      const personWords = personName.split(/\s+/).filter(w => w.length > 0)

      // Exact name match
      if (personName === nameLower) {
        return true
      }

      // Check if all words from the new name appear in existing person's name
      // or if all words from existing person appear in new name
      const allNewWordsMatch = nameWords.length > 0 && nameWords.every(word =>
        personWords.some(pw => pw.includes(word) || word.includes(pw))
      )
      const allExistingWordsMatch = personWords.length > 0 && personWords.every(word =>
        nameWords.some(nw => nw.includes(word) || word.includes(nw))
      )

      // If significant overlap in names
      if (allNewWordsMatch || allExistingWordsMatch) {
        return true
      }

      // Check first name + last initial or vice versa
      if (nameWords.length >= 1 && personWords.length >= 1) {
        const firstWordMatch = nameWords[0] === personWords[0]
        if (firstWordMatch && (nameWords.length === 1 || personWords.length === 1)) {
          return true
        }
      }

      return false
    })
  }

  const handleSavePerson = async (skipDuplicateCheck = false) => {
    if (!formData.name?.trim()) {
      showToast('Name is required', 'warning')
      return
    }

    // Only check for duplicates when creating new person (not updating)
    if (!formData.id && !skipDuplicateCheck) {
      const duplicates = checkForDuplicates(formData.name, formData.email || null)
      if (duplicates.length > 0) {
        setPotentialDuplicates(duplicates)
        setShowDuplicateWarning(true)
        return
      }
    }

    setLoading(true)

    try {
      const dataToSave = {
        name: formData.name,
        email: formData.email || null,
        role: formData.role || 'contact',
        status: formData.status || 'tracked',
        title: formData.title || null,
        bio: formData.bio || null,
        linkedin_url: formData.linkedin_url || null,
        twitter_url: formData.twitter_url || null,
        mobile_phone: formData.mobile_phone || null,
        location: formData.location || null,
        first_met_date: formData.first_met_date || null,
        introduced_by: formData.introduced_by || null,
        introduction_context: formData.introduction_context || null,
        relationship_notes: formData.relationship_notes || null,
      }

      if (formData.id) {
        // Update existing person
        const { error } = await supabase
          .from('saif_people')
          .update(dataToSave)
          .eq('id', formData.id)

        if (error) {
          showToast('Error updating person: ' + error.message, 'error')
          setLoading(false)
          return
        }
        showToast('Person updated', 'success')
      } else {
        // Create new person
        const { data: newPerson, error } = await supabase
          .from('saif_people')
          .insert(dataToSave)
          .select('id')
          .single()

        if (error) {
          showToast('Error creating person: ' + error.message, 'error')
          setLoading(false)
          return
        }

        // Link to company if selected
        if (selectedCompanyId && newPerson?.id) {
          const { error: linkError } = await supabase
            .from('saif_company_people')
            .insert({
              company_id: selectedCompanyId,
              user_id: newPerson.id,
              relationship_type: relationshipType as RelationshipType,
              title: formData.title || null,
            })

          if (linkError) {
            console.error('Error linking to company:', linkError)
            // Person was created, just show partial success
            showToast('Person added, but failed to link to company', 'warning')
          } else {
            showToast('Person added and linked to company', 'success')
          }
        } else {
          showToast('Person added', 'success')
        }
      }

      setShowAddModal(false)
      setFormData({})
      setSelectedCompanyId('')
      setPotentialDuplicates([])
      router.refresh()
    } catch (err) {
      showToast('An unexpected error occurred', 'error')
    }

    setLoading(false)
  }

  const handleProceedWithDuplicate = () => {
    setShowDuplicateWarning(false)
    handleSavePerson(true) // Skip duplicate check
  }

  const handleCancelDuplicate = () => {
    setShowDuplicateWarning(false)
    setPotentialDuplicates([])
  }

  const getCompanyNames = (associations: CompanyAssociation[]) => {
    return associations
      .filter(a => a.company)
      .map(a => a.company!.name)
      .join(', ')
  }

  // Get the URL for a company based on where it is in the pipeline
  const getCompanyUrl = (companyName: string): string | null => {
    const location = companyLocationMap[companyName.toLowerCase()]
    if (!location) return null

    const hashPrefix = location.page === 'portfolio' ? 'inv' : 'app'
    return `/${location.page}#${hashPrefix}-${location.id}`
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">People</h1>
            <p className="mt-1 text-gray-500">
              Track contacts, founders, and network connections
            </p>
          </div>
          <button onClick={openAddModal} className="btn btn-primary">
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Person
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#f5f5f5] rounded-xl flex items-center justify-center">
              <span className="text-2xl">👥</span>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total People</p>
              <p className="text-2xl font-bold text-gray-900">{people.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <span className="text-2xl">🚀</span>
            </div>
            <div>
              <p className="text-sm text-gray-500">Founders</p>
              <p className="text-2xl font-bold text-gray-900">{roleCounts.founder || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <span className="text-2xl">🤝</span>
            </div>
            <div>
              <p className="text-sm text-gray-500">Partners</p>
              <p className="text-2xl font-bold text-gray-900">{roleCounts.partner || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
              <span className="text-2xl">📇</span>
            </div>
            <div>
              <p className="text-sm text-gray-500">Contacts</p>
              <p className="text-2xl font-bold text-gray-900">{roleCounts.contact || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Role Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-2 mb-6 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          <button
            onClick={() => setRoleFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              roleFilter === 'all'
                ? 'bg-[#1a1a1a] text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            All ({roleCounts.all})
          </button>
          {(Object.keys(ROLE_LABELS) as UserRole[]).map(role => (
            <button
              key={role}
              onClick={() => setRoleFilter(role)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                roleFilter === role
                  ? 'bg-[#1a1a1a] text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {ROLE_LABELS[role]} ({roleCounts[role] || 0})
            </button>
          ))}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name, email, company, or title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input !pl-11"
            />
          </div>
          <div className="sm:w-40">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input"
            >
              <option value="all">All Status</option>
              {Object.keys(STATUS_LABELS).map(status => (
                <option key={status} value={status}>{STATUS_LABELS[status]}</option>
              ))}
            </select>
          </div>
          <div className="sm:w-44">
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="input"
            >
              <option value="name-az">Name (A-Z)</option>
              <option value="name-za">Name (Z-A)</option>
              <option value="role">Role</option>
              <option value="date-newest">Newest First</option>
              <option value="date-oldest">Oldest First</option>
            </select>
          </div>
        </div>
      </div>

      {/* People Table */}
      {filteredPeople.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">👤</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {people.length === 0 ? 'No people yet' : 'No matches found'}
          </h3>
          <p className="text-gray-500 mb-6">
            {people.length === 0
              ? 'Start tracking your network by adding your first contact.'
              : 'Try adjusting your search or filters.'}
          </p>
          {people.length === 0 && (
            <button onClick={openAddModal} className="btn btn-primary">
              Add Person
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-500">Name</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-500">Role</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-500 hidden md:table-cell">Company</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-500 hidden lg:table-cell">Email</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-500 hidden lg:table-cell">Location</th>
                  <th className="text-right py-4 px-6 text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPeople.map((person) => (
                  <tr
                    key={person.id}
                    className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedPerson(person)}
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-gray-600 font-medium">
                            {(person.displayName || '?').charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{person.displayName || 'Unknown'}</p>
                          {person.title && (
                            <p className="text-sm text-gray-500 truncate">{person.title}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`badge ${ROLE_COLORS[person.role]}`}>
                        {ROLE_LABELS[person.role]}
                      </span>
                    </td>
                    <td className="py-4 px-6 hidden md:table-cell">
                      <span className="text-gray-600 truncate max-w-[200px] block">
                        {getCompanyNames(person.company_associations) || '-'}
                      </span>
                    </td>
                    <td className="py-4 px-6 hidden lg:table-cell">
                      {person.email ? (
                        <a
                          href={`mailto:${person.email}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-gray-600 hover:text-[#1a1a1a] truncate max-w-[200px] block"
                        >
                          {person.email}
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-4 px-6 hidden lg:table-cell">
                      <span className="text-gray-600">{person.location || '-'}</span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-end gap-2">
                        {person.linkedin_url && (
                          <a
                            href={person.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                            title="LinkedIn"
                          >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                            </svg>
                          </a>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setNotesPersonId(person)
                          }}
                          className="p-2 text-gray-400 hover:text-[#1a1a1a] rounded-lg hover:bg-gray-100 transition-colors relative"
                          title="Meeting Notes"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          {person.noteCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#1a1a1a] text-white text-[10px] font-medium rounded-full flex items-center justify-center">
                              {person.noteCount}
                            </span>
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openEditModal(person)
                          }}
                          className="p-2 text-gray-400 hover:text-[#1a1a1a] rounded-lg hover:bg-gray-100 transition-colors"
                          title="Edit"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Person Detail Modal */}
      {selectedPerson && (
        <div className="modal-backdrop" onClick={() => setSelectedPerson(null)}>
          <div className="modal-content max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center">
                    <span className="text-gray-600 text-2xl font-medium">
                      {(selectedPerson.displayName || '?').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      {selectedPerson.displayName || 'Unknown'}
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`badge ${ROLE_COLORS[selectedPerson.role]}`}>
                        {ROLE_LABELS[selectedPerson.role]}
                      </span>
                      {selectedPerson.status && (
                        <span className="text-sm text-gray-500">
                          {STATUS_LABELS[selectedPerson.status]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPerson(null)}
                  className="text-gray-400 hover:text-gray-600 p-2 -m-2"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
              {selectedPerson.title && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Title</label>
                  <p className="text-gray-900">{selectedPerson.title}</p>
                </div>
              )}

              {selectedPerson.bio && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Bio</label>
                  <p className="text-gray-900 whitespace-pre-wrap">{selectedPerson.bio}</p>
                </div>
              )}

              {selectedPerson.company_associations.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-2">Companies</label>
                  <div className="space-y-2">
                    {selectedPerson.company_associations.map((assoc, idx) => {
                      if (!assoc.company) return null
                      const companyUrl = getCompanyUrl(assoc.company.name)
                      return (
                        <div key={idx} className="flex items-center gap-2 text-gray-900">
                          {companyUrl ? (
                            <a
                              href={companyUrl}
                              className="font-medium text-[#1a1a1a] hover:underline flex items-center gap-1"
                              onClick={() => setSelectedPerson(null)}
                            >
                              {assoc.company.name}
                              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          ) : (
                            <span className="font-medium">{assoc.company.name}</span>
                          )}
                          <span className="text-gray-400">-</span>
                          <span className="text-gray-600">{assoc.relationship_type}</span>
                          {assoc.title && (
                            <span className="text-gray-500">({assoc.title})</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                {selectedPerson.email && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Email</label>
                    <a
                      href={`mailto:${selectedPerson.email}`}
                      className="text-[#1a1a1a] hover:underline"
                    >
                      {selectedPerson.email}
                    </a>
                  </div>
                )}

                {selectedPerson.mobile_phone && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Phone</label>
                    <a
                      href={`tel:${selectedPerson.mobile_phone}`}
                      className="text-[#1a1a1a] hover:underline"
                    >
                      {selectedPerson.mobile_phone}
                    </a>
                  </div>
                )}

                {selectedPerson.location && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Location</label>
                    <p className="text-gray-900">{selectedPerson.location}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                {selectedPerson.linkedin_url && (
                  <a
                    href={selectedPerson.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                  >
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                    </svg>
                    LinkedIn
                  </a>
                )}
                {selectedPerson.twitter_url && (
                  <a
                    href={selectedPerson.twitter_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                  >
                    Twitter
                  </a>
                )}
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => {
                  setNotesPersonId(selectedPerson)
                  setSelectedPerson(null)
                }}
                className="btn btn-secondary flex-1"
              >
                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Meeting Notes
              </button>
              <button
                onClick={() => openEditModal(selectedPerson)}
                className="btn btn-primary flex-1"
              >
                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Person Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => !loading && setShowAddModal(false)}>
          <div className="modal-content max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {formData.id ? 'Edit Person' : 'Add New Person'}
                  </h2>
                  <p className="text-gray-500 mt-1">
                    {formData.id ? 'Update contact information' : 'Add someone to your network'}
                  </p>
                </div>
                <button
                  onClick={() => !loading && setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-2 -m-2"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  placeholder="Full name"
                  required
                />
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input"
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.mobile_phone || ''}
                    onChange={(e) => setFormData({ ...formData, mobile_phone: e.target.value })}
                    className="input"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Role *
                  </label>
                  <select
                    value={formData.role || 'contact'}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                    className="input"
                  >
                    {(Object.keys(ROLE_LABELS) as UserRole[]).map(role => (
                      <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Status
                  </label>
                  <select
                    value={formData.status || 'tracked'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="input"
                  >
                    {Object.keys(STATUS_LABELS).map(status => (
                      <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Title
                </label>
                <input
                  type="text"
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="input"
                  placeholder="Job title or role"
                />
              </div>

              {/* Company Linking - only shown when creating new person */}
              {!formData.id && (
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    Link to Company (Optional)
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1.5">
                        Company
                      </label>
                      <select
                        value={selectedCompanyId}
                        onChange={(e) => setSelectedCompanyId(e.target.value)}
                        className="input"
                      >
                        <option value="">No company</option>
                        {companies.map(company => (
                          <option key={company.id} value={company.id}>{company.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1.5">
                        Relationship
                      </label>
                      <select
                        value={relationshipType}
                        onChange={(e) => setRelationshipType(e.target.value)}
                        className="input"
                        disabled={!selectedCompanyId}
                      >
                        <option value="employee">Employee</option>
                        <option value="founder">Founder</option>
                        <option value="advisor">Advisor</option>
                        <option value="board_member">Board Member</option>
                        <option value="partner">Partner</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  LinkedIn URL
                </label>
                <input
                  type="url"
                  value={formData.linkedin_url || ''}
                  onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
                  className="input"
                  placeholder="https://linkedin.com/in/username"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Twitter URL
                </label>
                <input
                  type="url"
                  value={formData.twitter_url || ''}
                  onChange={(e) => setFormData({ ...formData, twitter_url: e.target.value })}
                  className="input"
                  placeholder="https://twitter.com/username"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Location
                </label>
                <input
                  type="text"
                  value={formData.location || ''}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="input"
                  placeholder="City, Country"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Bio
                </label>
                <textarea
                  value={formData.bio || ''}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  rows={3}
                  className="input resize-none"
                  placeholder="Brief background or notes about this person..."
                />
              </div>

              {/* Relationship Tracking Section */}
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-blue-800">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                  Relationship Tracking
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      First Met Date
                    </label>
                    <input
                      type="date"
                      value={formData.first_met_date || ''}
                      onChange={(e) => setFormData({ ...formData, first_met_date: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Introduced By
                    </label>
                    <select
                      value={formData.introduced_by || ''}
                      onChange={(e) => setFormData({ ...formData, introduced_by: e.target.value })}
                      className="input"
                    >
                      <option value="">Select a person...</option>
                      {people
                        .filter(p => p.id !== formData.id)
                        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                        .map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name || p.displayName || `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email || 'Unknown'}
                          </option>
                        ))
                      }
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    How We Met / Introduction Context
                  </label>
                  <textarea
                    value={formData.introduction_context || ''}
                    onChange={(e) => setFormData({ ...formData, introduction_context: e.target.value })}
                    rows={2}
                    className="input resize-none"
                    placeholder="e.g., Met at YC Demo Day, introduced via email by John..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Relationship Notes
                  </label>
                  <textarea
                    value={formData.relationship_notes || ''}
                    onChange={(e) => setFormData({ ...formData, relationship_notes: e.target.value })}
                    rows={2}
                    className="input resize-none"
                    placeholder="Ongoing notes about the relationship..."
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setFormData({})
                }}
                className="btn btn-secondary flex-1"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={() => handleSavePerson()}
                disabled={loading || !formData.name?.trim()}
                className="btn btn-primary flex-1"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Saving...
                  </span>
                ) : formData.id ? (
                  'Update Person'
                ) : (
                  'Add Person'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Warning Modal */}
      {showDuplicateWarning && potentialDuplicates.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-xl">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Potential Duplicate Found</h2>
                  <p className="text-sm text-gray-500">Similar people already exist in the system</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <p className="text-gray-700 mb-4">
                We found <span className="font-semibold">{potentialDuplicates.length}</span> existing {potentialDuplicates.length === 1 ? 'person' : 'people'} with a similar name or email:
              </p>

              <div className="space-y-3 max-h-60 overflow-y-auto">
                {potentialDuplicates.map(person => (
                  <div
                    key={person.id}
                    className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center text-white font-medium">
                        {(person.displayName || person.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {person.displayName || person.name}
                        </p>
                        {person.email && (
                          <p className="text-sm text-gray-500 truncate">{person.email}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${ROLE_COLORS[person.role]}`}>
                            {ROLE_LABELS[person.role]}
                          </span>
                          {person.title && (
                            <span className="text-xs text-gray-500">{person.title}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-sm text-gray-500 mt-4">
                Are you sure you want to create a new person named <span className="font-medium">"{formData.name}"</span>?
              </p>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button
                onClick={handleCancelDuplicate}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleProceedWithDuplicate}
                className="btn bg-amber-600 hover:bg-amber-700 text-white flex-1"
              >
                Create Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Meeting Notes Modal */}
      {notesPersonId && (
        <PersonMeetingNotes
          personId={notesPersonId.id}
          personName={notesPersonId.displayName || 'Unknown'}
          userId={userId}
          userName={userName}
          onClose={() => setNotesPersonId(null)}
        />
      )}
    </div>
  )
}
