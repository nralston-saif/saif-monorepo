'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import ApplicationDetailModal from '@/components/ApplicationDetailModal'
import InvestmentMeetingNotes from '@/components/InvestmentMeetingNotes'
import CreateTicketButton from '@/components/CreateTicketButton'
import { ensureProtocol } from '@/lib/utils'

type MeetingNote = {
  id: string
  content: string
  meeting_date: string | null
  created_at: string | null
  user_name: string | null
}

type Founder = {
  id: string
  name: string
  email: string | null
  avatar_url: string | null
  title: string | null
}

type Investment = {
  id: string
  company_id: string
  company_name: string
  logo_url: string | null
  short_description: string | null
  website: string | null
  investment_date: string | null
  type: string | null
  amount: number | null
  round: string | null
  post_money_valuation: number | null
  status: string | null
  founders: Founder[]
  deliberationNotes: string | null
  meetingNotes: MeetingNote[]
}

type SortOption = 'date-newest' | 'date-oldest' | 'name-az' | 'name-za' | 'amount-high' | 'amount-low'

export default function PortfolioClient({
  investments,
  userId,
  userName,
}: {
  investments: Investment[]
  userId: string
  userName: string
}) {
  const [selectedInvestment, setSelectedInvestment] = useState<Investment | null>(null)
  const [meetingNotesInvestment, setMeetingNotesInvestment] = useState<Investment | null>(null)

  // Search and sort state
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOption, setSortOption] = useState<SortOption>('date-newest')

  const router = useRouter()

  // Filter and sort investments
  const filteredInvestments = useMemo(() => {
    let filtered = investments

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(inv =>
        inv.company_name.toLowerCase().includes(query) ||
        inv.founders.some(f => f.name.toLowerCase().includes(query)) ||
        (inv.short_description?.toLowerCase().includes(query))
      )
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (sortOption) {
        case 'date-newest':
          if (!a.investment_date) return 1
          if (!b.investment_date) return -1
          return new Date(b.investment_date).getTime() - new Date(a.investment_date).getTime()
        case 'date-oldest':
          if (!a.investment_date) return 1
          if (!b.investment_date) return -1
          return new Date(a.investment_date).getTime() - new Date(b.investment_date).getTime()
        case 'name-az':
          return a.company_name.localeCompare(b.company_name)
        case 'name-za':
          return b.company_name.localeCompare(a.company_name)
        case 'amount-high':
          return (b.amount || 0) - (a.amount || 0)
        case 'amount-low':
          return (a.amount || 0) - (b.amount || 0)
        default:
          return 0
      }
    })

    return sorted
  }, [investments, searchQuery, sortOption])

  const openViewModal = (investment: Investment) => {
    setSelectedInvestment(investment)
  }

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '-'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatMonth = (date: string | null) => {
    if (!date) return null
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
    })
  }

  // Calculate stats
  const totalInvested = investments.reduce((sum, inv) => sum + (inv.amount || 0), 0)
  const investmentsWithAmount = investments.filter(inv => inv.amount && inv.amount > 0)
  const averageCheckSize = investmentsWithAmount.length > 0
    ? totalInvested / investmentsWithAmount.length
    : 0

  // Calculate investments by month using sortable keys (YYYY-MM format)
  const investmentsByMonth: Record<string, { count: number; amount: number; label: string; companies: string[] }> = {}
  investments.forEach(inv => {
    if (!inv.investment_date) return
    const date = new Date(inv.investment_date)
    // Use YYYY-MM as key for proper sorting
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    // Create readable label
    const label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

    if (!investmentsByMonth[key]) {
      investmentsByMonth[key] = { count: 0, amount: 0, label, companies: [] }
    }
    investmentsByMonth[key].count++
    investmentsByMonth[key].amount += inv.amount || 0
    investmentsByMonth[key].companies.push(inv.company_name)
  })

  // Sort months chronologically and take last 6
  const sortedMonths = Object.entries(investmentsByMonth)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-6)

  const maxMonthlyAmount = Math.max(...sortedMonths.map(([, data]) => data.amount), 1)
  const maxMonthlyCount = Math.max(...sortedMonths.map(([, data]) => data.count), 1)

  // Convert investment to application format for the modal
  const investmentToApplication = (inv: Investment) => ({
    id: inv.id,
    company_name: inv.company_name,
    founder_names: inv.founders.map(f => f.name).join(', '),
    company_description: inv.short_description,
    website: inv.website,
    deck_link: null,
    submitted_at: inv.investment_date || new Date().toISOString(),
    stage: 'invested',
  })

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Portfolio</h1>
            <p className="mt-1 text-gray-500">
              Track and manage your investments
            </p>
          </div>
          <CreateTicketButton currentUserId={userId} />
        </div>
      </div>

      {/* Dashboard */}
      <div className="mb-8">
        <div className="grid gap-4 md:grid-cols-3">
          {/* Total Investments */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#f5f5f5] rounded-xl flex items-center justify-center">
                <span className="text-2xl">📊</span>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Investments</p>
                <p className="text-2xl font-bold text-gray-900">{investments.length}</p>
              </div>
            </div>
          </div>

          {/* Total Invested */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <span className="text-2xl">💰</span>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Invested</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalInvested)}</p>
              </div>
            </div>
          </div>

          {/* Average Check */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <span className="text-2xl">📝</span>
              </div>
              <div>
                <p className="text-sm text-gray-500">Average Check</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(averageCheckSize)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Chart */}
        {sortedMonths.length > 0 && (
          <div className="mt-4 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                Investment Activity
              </h3>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-[#1a1a1a] rounded"></div>
                  <span>Amount</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                  <span>Count</span>
                </div>
              </div>
            </div>

            <div className="flex items-end gap-4 h-40">
              {sortedMonths.map(([key, data]) => (
                <div key={key} className="flex-1 flex flex-col items-center group relative">
                  {/* Bar container */}
                  <div className="relative w-full h-32 flex items-end justify-center gap-1">
                    {/* Amount bar */}
                    <div
                      className="w-5 bg-[#1a1a1a] rounded-t transition-all group-hover:bg-gray-700"
                      style={{
                        height: `${Math.max((data.amount / maxMonthlyAmount) * 100, 4)}%`,
                      }}
                    />
                    {/* Count indicator */}
                    <div
                      className="w-5 bg-emerald-500 rounded-t transition-all group-hover:bg-emerald-400"
                      style={{
                        height: `${Math.max((data.count / maxMonthlyCount) * 100, 4)}%`,
                      }}
                    />
                  </div>

                  {/* Tooltip on hover */}
                  <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg transition-opacity pointer-events-none z-10 min-w-[180px]">
                    <p className="font-semibold text-sm border-b border-gray-700 pb-1 mb-2">{data.label}</p>
                    <div className="space-y-1 mb-2 max-h-32 overflow-y-auto">
                      {data.companies.map((company, idx) => (
                        <p key={idx} className="text-gray-300">• {company}</p>
                      ))}
                    </div>
                    <div className="border-t border-gray-700 pt-2 mt-2">
                      <p className="font-medium">{formatCurrency(data.amount)} total</p>
                      <p className="text-gray-400">{data.count} investment{data.count !== 1 ? 's' : ''}</p>
                    </div>
                  </div>

                  {/* Month label */}
                  <div className="mt-3 text-center">
                    <p className="text-xs font-medium text-gray-700">
                      {data.label.split(' ')[0]}
                    </p>
                    <p className="text-xs text-gray-400">
                      {data.label.split(' ')[1]}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary row */}
            <div className="mt-6 pt-4 border-t border-gray-100 flex justify-between text-sm">
              <div>
                <span className="text-gray-500">Last 6 Months Total: </span>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(sortedMonths.reduce((sum, [, d]) => sum + d.amount, 0))}
                </span>
              </div>
              <div>
                <span className="font-semibold text-gray-900">
                  {sortedMonths.reduce((sum, [, d]) => sum + d.count, 0)}
                </span>
                <span className="text-gray-500"> investments in last 6 months</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Search and Sort Controls */}
      {investments.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search Bar */}
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by company, founder, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input !pl-11"
              />
            </div>

            {/* Sort Dropdown */}
            <div className="sm:w-56">
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="input"
              >
                <option value="date-newest">Date (Newest First)</option>
                <option value="date-oldest">Date (Oldest First)</option>
                <option value="name-az">Name (A-Z)</option>
                <option value="name-za">Name (Z-A)</option>
                <option value="amount-high">Amount (High to Low)</option>
                <option value="amount-low">Amount (Low to High)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {investments.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">💼</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No investments found</h3>
          <p className="text-gray-500">Investments from saif_investments will appear here.</p>
        </div>
      ) : filteredInvestments.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <p className="text-gray-500">No investments match your search.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredInvestments.map((investment) => (
            <div
              key={investment.id}
              id={`inv-${investment.id}`}
              onClick={() => openViewModal(investment)}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden card-hover cursor-pointer"
            >
              <div className="p-6">
                <div className="flex items-start gap-3 mb-3">
                  {/* Company Logo */}
                  {investment.logo_url ? (
                    <img
                      src={investment.logo_url}
                      alt={investment.company_name}
                      className="w-10 h-10 object-contain flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-lg font-bold text-gray-400">
                        {investment.company_name[0]}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">
                        {investment.company_name}
                      </h3>
                      {investment.status && investment.status !== 'active' && (
                        <span className={`badge ml-2 flex-shrink-0 ${
                          investment.status === 'acquired' ? 'badge-green' :
                          investment.status === 'ipo' ? 'badge-blue' :
                          'badge-gray'
                        }`}>
                          {investment.status.charAt(0).toUpperCase() + investment.status.slice(1)}
                        </span>
                      )}
                    </div>
                    {investment.founders.length > 0 && (
                      <p className="text-sm text-gray-500 mt-0.5 truncate">
                        {investment.founders.map(f => f.name).join(', ')}
                      </p>
                    )}
                  </div>
                </div>

                {investment.short_description && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {investment.short_description}
                  </p>
                )}

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Amount</span>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(investment.amount)}
                    </span>
                  </div>
                  {(investment.type || investment.round) && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Round</span>
                      <span className="text-gray-700 font-medium">
                        {[investment.round, investment.type === 'safe' ? 'SAFE' : investment.type ? investment.type.charAt(0).toUpperCase() + investment.type.slice(1) : null].filter(Boolean).join(' • ')}
                      </span>
                    </div>
                  )}
                  {investment.post_money_valuation && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">{investment.type?.toLowerCase() === 'safe' ? 'Cap' : 'Valuation'}</span>
                      <span className="text-gray-700 font-medium">
                        ${(investment.post_money_valuation / 1000000).toFixed(0)}M
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Date</span>
                    <span className="text-gray-700">
                      {formatDate(investment.investment_date)}
                    </span>
                  </div>
                </div>

                {/* Links and Notes */}
                <div className="flex items-center gap-3 mt-4">
                  {investment.website && (
                    <a
                      href={ensureProtocol(investment.website)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-sm text-[#1a1a1a] hover:text-black underline"
                    >
                      <span>🌐</span> Website
                    </a>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setMeetingNotesInvestment(investment)
                    }}
                    className="inline-flex items-center gap-1.5 text-sm text-[#1a1a1a] bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Notes
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Investment Modal - Using ApplicationDetailModal */}
      {selectedInvestment && (
        <ApplicationDetailModal
          application={investmentToApplication(selectedInvestment)}
          investment={{
            amount: selectedInvestment.amount,
            investment_date: selectedInvestment.investment_date,
            terms: [
              selectedInvestment.round,
              selectedInvestment.type === 'safe' ? 'SAFE' : selectedInvestment.type ? selectedInvestment.type.charAt(0).toUpperCase() + selectedInvestment.type.slice(1) : null,
              selectedInvestment.post_money_valuation ? `$${(selectedInvestment.post_money_valuation / 1000000).toFixed(0)}M ${selectedInvestment.type?.toLowerCase() === 'safe' ? 'cap' : 'post'}` : null
            ].filter(Boolean).join(' • ') || null,
            other_funders: null,
            contact_name: selectedInvestment.founders[0]?.name || null,
            contact_email: selectedInvestment.founders[0]?.email || null,
            notes: null,
            stealthy: false,
          }}
          onClose={() => setSelectedInvestment(null)}
          actions={
            <div className="flex gap-2">
              <button
                onClick={() => router.push(`/companies/${selectedInvestment.company_id}`)}
                className="btn btn-secondary"
              >
                View Company
              </button>
              <button
                onClick={() => {
                  setSelectedInvestment(null)
                  router.push(`/companies/${selectedInvestment.company_id}?edit=true`)
                }}
                className="btn btn-primary"
              >
                Edit Company
              </button>
            </div>
          }
        />
      )}

      {/* Add/Edit Investment Modal - Disabled (investments managed via saif_investments table) */}

      {/* Meeting Notes Modal with Liveblocks */}
      {meetingNotesInvestment && (
        <InvestmentMeetingNotes
          investmentId={meetingNotesInvestment.id}
          companyId={meetingNotesInvestment.company_id}
          companyName={meetingNotesInvestment.company_name}
          userId={userId}
          userName={userName}
          onClose={() => setMeetingNotesInvestment(null)}
        />
      )}
    </div>
  )
}
