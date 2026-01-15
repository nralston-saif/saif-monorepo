'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Database } from '@/lib/types/database'
import { sanitizeUrl } from '@/lib/sanitize'

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

export default function CompanyGrid({ companies, isPartner = false }: CompanyGridProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')

  // Filter companies based on search
  const filteredCompanies = companies.filter((company) => {
    if (!searchQuery.trim()) return true

    const query = searchQuery.toLowerCase()
    const nameMatch = company.name.toLowerCase().includes(query)
    const descriptionMatch = company.short_description?.toLowerCase().includes(query)
    const industryMatch = company.industry?.toLowerCase().includes(query)
    const cityMatch = company.city?.toLowerCase().includes(query)

    return nameMatch || descriptionMatch || industryMatch || cityMatch
  })

  return (
    <div>
      {/* Search Bar */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search companies by name, industry, or location..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
        />
      </div>

      {/* Results Count */}
      <div className="mb-4">
        <p className="text-sm text-gray-600">
          {filteredCompanies.length === companies.length
            ? `${companies.length} ${companies.length === 1 ? 'company' : 'companies'}`
            : `${filteredCompanies.length} of ${companies.length} companies`
          }
        </p>
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
              (p) => p.relationship_type === 'founder' && p.person && !p.end_date
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

                {/* Company Name */}
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {company.name}
                </h3>

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
                          <div key={person.id} className="flex items-center space-x-2">
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
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {person.first_name} {person.last_name}
                              </p>
                              {person.title && (
                                <p className="text-xs text-gray-500 truncate">
                                  {person.title}
                                </p>
                              )}
                            </div>
                          </div>
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
                {sanitizeUrl(company.website) && (
                  <div className="mt-4">
                    <a
                      href={sanitizeUrl(company.website)!}
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
    </div>
  )
}
