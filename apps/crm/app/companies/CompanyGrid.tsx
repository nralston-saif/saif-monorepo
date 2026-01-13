'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Database, CompanyStage } from '@/lib/types/database'
import PersonModal from '@/components/PersonModal'
import { ensureProtocol } from '@/lib/utils'

type Company = Database['public']['Tables']['saif_companies']['Row'] & {
  people?: Array<{
    user_id: string
    relationship_type: string
    is_primary_contact: boolean
    end_date: string | null
    person: {
      id: string
      first_name: string | null
      last_name: string | null
      title: string | null
      avatar_url: string | null
    } | null
  }>
  investments?: Array<{
    id: string
    amount: number | null
    round: string | null
    type: string | null
  }>
}

interface CompanyGridProps {
  companies: Company[]
  isPartner?: boolean
}

const STAGE_OPTIONS = ['prospect', 'portfolio', 'diligence', 'passed', 'tracked', 'archived'] as const

export default function CompanyGrid({ companies, isPartner = false }: CompanyGridProps) {
  const router = useRouter()
  const supabase = createClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [stageFilter, setStageFilter] = useState<string>('all')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)

  // Add Company Modal State
  const [showAddModal, setShowAddModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newCompany, setNewCompany] = useState({
    name: '',
    short_description: '',
    website: '',
    industry: '',
    city: '',
    country: '',
    founded_year: '',
    yc_batch: '',
    stage: 'prospect' as CompanyStage,
    is_aisafety_company: false,
  })

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const { data, error: insertError } = await supabase
        .from('saif_companies')
        .insert({
          name: newCompany.name,
          short_description: newCompany.short_description || null,
          website: newCompany.website || null,
          industry: newCompany.industry || null,
          city: newCompany.city || null,
          country: newCompany.country || null,
          founded_year: newCompany.founded_year ? parseInt(newCompany.founded_year) : null,
          yc_batch: newCompany.yc_batch || null,
          stage: newCompany.stage,
          is_aisafety_company: newCompany.is_aisafety_company,
          is_active: true,
        })
        .select()
        .single()

      if (insertError) throw insertError

      // Reset form and close modal
      setShowAddModal(false)
      setNewCompany({
        name: '',
        short_description: '',
        website: '',
        industry: '',
        city: '',
        country: '',
        founded_year: '',
        yc_batch: '',
        stage: 'prospect' as CompanyStage,
        is_aisafety_company: false,
      })

      // Navigate to the new company's page
      if (data?.id) {
        router.push(`/companies/${data.id}`)
      } else {
        router.refresh()
      }
    } catch (err: any) {
      console.error('Error creating company:', err)
      setError(err?.message || 'Failed to create company')
    } finally {
      setSaving(false)
    }
  }

  // Calculate stage counts for the summary pills
  const stageCounts: Record<string, number> = {}
  for (const company of companies) {
    const stage = company.stage || 'unknown'
    stageCounts[stage] = (stageCounts[stage] || 0) + 1
  }

  // Define stage display order and colors
  // Using inline styles for active state to avoid Tailwind purging issues
  const stageConfig: Record<string, { label: string; bgColor: string; textColor: string; activeBg: string }> = {
    portfolio: { label: 'Portfolio', bgColor: '#dcfce7', textColor: '#166534', activeBg: '#16a34a' },
    prospect: { label: 'Prospect', bgColor: '#dbeafe', textColor: '#1e40af', activeBg: '#2563eb' },
    diligence: { label: 'Diligence', bgColor: '#fef3c7', textColor: '#92400e', activeBg: '#d97706' },
    passed: { label: 'Passed', bgColor: '#f3f4f6', textColor: '#4b5563', activeBg: '#4b5563' },
    tracked: { label: 'Tracked', bgColor: '#f3e8ff', textColor: '#7e22ce', activeBg: '#9333ea' },
    archived: { label: 'Archived', bgColor: '#f3f4f6', textColor: '#6b7280', activeBg: '#6b7280' },
    saif: { label: 'SAIF', bgColor: '#e0e7ff', textColor: '#3730a3', activeBg: '#4f46e5' },
  }

  // Filter companies based on search and stage
  const filteredCompanies = companies
    .filter((company) => {
      // Stage filter
      if (stageFilter !== 'all' && company.stage !== stageFilter) {
        return false
      }

      // Search filter
      if (!searchQuery.trim()) return true

      const query = searchQuery.toLowerCase()
      const nameMatch = company.name.toLowerCase().includes(query)
      const descriptionMatch = company.short_description?.toLowerCase().includes(query)
      const industryMatch = company.industry?.toLowerCase().includes(query)
      const cityMatch = company.city?.toLowerCase().includes(query)

      return nameMatch || descriptionMatch || industryMatch || cityMatch
    })
    .sort((a, b) => {
      const comparison = a.name.localeCompare(b.name)
      return sortOrder === 'asc' ? comparison : -comparison
    })

  return (
    <div>
      {/* Header with count (Partners Only) */}
      {isPartner && (
        <div className="mb-6 flex items-center gap-4">
          <h1 className="text-3xl font-bold text-gray-900">All Companies</h1>
          <span className="text-lg text-gray-400 font-medium">
            {filteredCompanies.length === companies.length
              ? companies.length
              : `${filteredCompanies.length}/${companies.length}`}
          </span>
        </div>
      )}

      {/* Search Bar */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search companies by name, industry, or location..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
        />
      </div>

      {/* Stage Filters, Sort, and Actions - All in one row */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {/* Stage Count Pills (Partners Only) */}
        {isPartner && (
          <>
            {/* All button */}
            <button
              onClick={() => setStageFilter('all')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                stageFilter === 'all'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({companies.length})
            </button>
            {/* Stage pills - always show all stages that exist in the full company list */}
            {['portfolio', 'prospect', 'diligence', 'passed', 'tracked', 'archived', 'saif'].map((stage) => {
              const count = stageCounts[stage] || 0
              if (count === 0) return null
              const config = stageConfig[stage]
              const isActive = stageFilter === stage
              return (
                <button
                  key={`stage-pill-${stage}`}
                  type="button"
                  onClick={() => setStageFilter(isActive ? 'all' : stage)}
                  style={{
                    backgroundColor: isActive ? config.activeBg : config.bgColor,
                    color: isActive ? '#ffffff' : config.textColor,
                  }}
                  className="px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                >
                  {config.label} ({count})
                </button>
              )
            })}
          </>
        )}

        {/* Sort Order and Add Button - pushed to right */}
        <div className="ml-auto flex items-center gap-3">
          <select
            id="sort-order"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
            className="px-3 py-1.5 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
          >
            <option value="asc">A-Z</option>
            <option value="desc">Z-A</option>
          </select>
          {isPartner && (
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800"
            >
              + Add
            </button>
          )}
        </div>
      </div>

      {/* Company Grid */}
      {filteredCompanies.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No companies match your search</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCompanies.map((company) => {
            // Get current founders for this company (exclude former founders)
            const founders = company.people?.filter(
              (p) => p.relationship_type?.toLowerCase() === 'founder' && p.person && !p.end_date
            ) || []

            return (
              <div
                key={company.id}
                onClick={() => router.push(`/companies/${company.id}`)}
                className="border border-gray-200 rounded-lg p-6 hover:border-gray-300 transition hover:shadow-md cursor-pointer"
              >
                {/* Company Logo */}
                {company.logo_url ? (
                  <img
                    src={company.logo_url}
                    alt={company.name}
                    className="h-16 w-16 object-contain mb-4"
                  />
                ) : (
                  <div className="h-16 w-16 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
                    <span className="text-2xl font-bold text-gray-400">
                      {company.name[0]}
                    </span>
                  </div>
                )}

                {/* Company Name and Stage */}
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {company.name}
                  </h3>
                  {isPartner && company.stage && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ml-2 flex-shrink-0 ${
                      company.stage === 'portfolio' ? 'bg-green-100 text-green-800' :
                      company.stage === 'saif' ? 'bg-purple-100 text-purple-800' :
                      company.stage === 'prospect' ? 'bg-blue-100 text-blue-800' :
                      company.stage === 'passed' ? 'bg-gray-100 text-gray-600' :
                      company.stage === 'dead' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {company.stage}
                    </span>
                  )}
                </div>

                {/* Description */}
                {company.short_description && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                    {company.short_description}
                  </p>
                )}

                {/* Company Info */}
                <div className="space-y-1 mb-4">
                  {company.industry && (
                    <p className="text-xs text-gray-500">
                      Industry: {company.industry}
                    </p>
                  )}
                  {company.city && company.country && (
                    <p className="text-xs text-gray-500">
                      Location: {company.city}, {company.country}
                    </p>
                  )}
                  {company.founded_year && (
                    <p className="text-xs text-gray-500">
                      Founded: {company.founded_year}
                    </p>
                  )}
                  {company.yc_batch && (
                    <p className="text-xs text-gray-500">
                      YC: {company.yc_batch}
                    </p>
                  )}
                  {company.is_aisafety_company && (
                    <p className="text-xs text-blue-600 font-medium">
                      AI Safety Company
                    </p>
                  )}
                </div>

                {/* Founders */}
                {founders.length > 0 && (
                  <div className="border-t border-gray-200 pt-4">
                    <p className="text-xs font-medium text-gray-500 mb-2">
                      {founders.length === 1 ? 'Founder' : 'Founders'}
                    </p>
                    <div className="space-y-2">
                      {founders.slice(0, 3).map((founder) => {
                        const person = founder.person
                        if (!person) return null

                        return (
                          <button
                            key={person.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedPersonId(person.id)
                            }}
                            className="flex items-center space-x-2 w-full text-left hover:bg-gray-50 rounded-md p-1 -m-1 transition-colors"
                          >
                            {person.avatar_url ? (
                              <img
                                src={person.avatar_url}
                                alt={`${person.first_name} ${person.last_name}`}
                                className="h-8 w-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                                <span className="text-xs text-gray-600">
                                  {person.first_name?.[0] || '?'}
                                </span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate hover:underline">
                                {person.first_name} {person.last_name}
                              </p>
                              {person.title && (
                                <p className="text-xs text-gray-500 truncate">
                                  {person.title}
                                </p>
                              )}
                            </div>
                          </button>
                        )
                      })}
                      {founders.length > 3 && (
                        <p className="text-xs text-gray-500">
                          +{founders.length - 3} more
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Investment Summary (Partners Only) */}
                {isPartner && company.investments && company.investments.length > 0 && (
                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <p className="text-xs font-medium text-gray-500 mb-1">Investment</p>
                    <p className="text-sm font-semibold text-gray-900">
                      ${company.investments.reduce((sum, inv) => sum + (inv.amount || 0), 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500">
                      {company.investments.length} {company.investments.length === 1 ? 'round' : 'rounds'}
                      {company.investments[0]?.round && ` • Latest: ${company.investments[0].round}`}
                    </p>
                  </div>
                )}

                {/* Website Link */}
                {company.website && (
                  <div className="mt-4">
                    <a
                      href={ensureProtocol(company.website)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-sm text-gray-900 hover:text-gray-700 underline"
                    >
                      Visit Website →
                    </a>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add Company Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Add New Company</h2>
                <button
                  onClick={() => {
                    setShowAddModal(false)
                    setError(null)
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <form onSubmit={handleCreateCompany} className="space-y-4">
                <div>
                  <label htmlFor="company-name" className="block text-sm font-medium text-gray-700 mb-1">
                    Company Name *
                  </label>
                  <input
                    id="company-name"
                    type="text"
                    required
                    value={newCompany.name}
                    onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                    placeholder="Acme Inc"
                  />
                </div>

                <div>
                  <label htmlFor="company-stage" className="block text-sm font-medium text-gray-700 mb-1">
                    Stage *
                  </label>
                  <select
                    id="company-stage"
                    required
                    value={newCompany.stage || ''}
                    onChange={(e) => setNewCompany({ ...newCompany, stage: e.target.value as CompanyStage })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                  >
                    {STAGE_OPTIONS.map((stage) => (
                      <option key={stage} value={stage}>
                        {stage.charAt(0).toUpperCase() + stage.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="company-description" className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    id="company-description"
                    rows={3}
                    value={newCompany.short_description}
                    onChange={(e) => setNewCompany({ ...newCompany, short_description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                    placeholder="Brief description of what the company does..."
                  />
                </div>

                <div>
                  <label htmlFor="company-website" className="block text-sm font-medium text-gray-700 mb-1">
                    Website
                  </label>
                  <input
                    id="company-website"
                    type="url"
                    value={newCompany.website}
                    onChange={(e) => setNewCompany({ ...newCompany, website: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                    placeholder="https://example.com"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="company-industry" className="block text-sm font-medium text-gray-700 mb-1">
                      Industry
                    </label>
                    <input
                      id="company-industry"
                      type="text"
                      value={newCompany.industry}
                      onChange={(e) => setNewCompany({ ...newCompany, industry: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                      placeholder="AI/ML"
                    />
                  </div>
                  <div>
                    <label htmlFor="company-founded" className="block text-sm font-medium text-gray-700 mb-1">
                      Founded Year
                    </label>
                    <input
                      id="company-founded"
                      type="number"
                      min="1900"
                      max="2100"
                      value={newCompany.founded_year}
                      onChange={(e) => setNewCompany({ ...newCompany, founded_year: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                      placeholder="2024"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="company-city" className="block text-sm font-medium text-gray-700 mb-1">
                      City
                    </label>
                    <input
                      id="company-city"
                      type="text"
                      value={newCompany.city}
                      onChange={(e) => setNewCompany({ ...newCompany, city: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                      placeholder="San Francisco"
                    />
                  </div>
                  <div>
                    <label htmlFor="company-country" className="block text-sm font-medium text-gray-700 mb-1">
                      Country
                    </label>
                    <input
                      id="company-country"
                      type="text"
                      value={newCompany.country}
                      onChange={(e) => setNewCompany({ ...newCompany, country: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                      placeholder="United States"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="company-yc" className="block text-sm font-medium text-gray-700 mb-1">
                    YC Batch
                  </label>
                  <input
                    id="company-yc"
                    type="text"
                    value={newCompany.yc_batch}
                    onChange={(e) => setNewCompany({ ...newCompany, yc_batch: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                    placeholder="S24, W25, etc."
                  />
                </div>

                <div className="flex items-center">
                  <input
                    id="company-aisafety"
                    type="checkbox"
                    checked={newCompany.is_aisafety_company}
                    onChange={(e) => setNewCompany({ ...newCompany, is_aisafety_company: e.target.checked })}
                    className="h-4 w-4 text-gray-900 focus:ring-gray-900 border-gray-300 rounded"
                  />
                  <label htmlFor="company-aisafety" className="ml-2 block text-sm text-gray-700">
                    AI Safety Company
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false)
                      setError(null)
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Creating...' : 'Create Company'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Person Modal */}
      {selectedPersonId && (
        <PersonModal
          personId={selectedPersonId}
          onClose={() => setSelectedPersonId(null)}
        />
      )}
    </div>
  )
}
