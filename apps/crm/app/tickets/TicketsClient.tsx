'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { TicketStatus, TicketPriority } from '@saif/supabase'
import CreateTicketModal from './CreateTicketModal'
import TicketDetailModal from './TicketDetailModal'

type Partner = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  avatar_url: string | null
}

type Company = {
  id: string
  name: string
  logo_url?: string | null
}

type Person = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
}

type TicketComment = {
  id: string
  content: string
  is_final_comment: boolean
  created_at: string
  author?: Partner | null
}

type Ticket = {
  id: string
  title: string
  description: string | null
  status: TicketStatus
  priority: TicketPriority
  due_date: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
  assigned_to: string | null
  created_by: string
  related_company: string | null
  related_person: string | null
  tags: string[] | null
  assigned_partner?: Partner | null
  creator?: Partner | null
  company?: Company | null
  person?: Person | null
  comments?: TicketComment[]
}

type StatusFilter = 'active' | 'archived' | 'all'
type SortOption = 'date-newest' | 'date-oldest' | 'priority' | 'due-date' | 'title'

export default function TicketsClient({
  tickets,
  partners,
  companies,
  people,
  currentUserId,
  userName,
}: {
  tickets: Ticket[]
  partners: Partner[]
  companies: Company[]
  people: Person[]
  currentUserId: string
  userName: string
}) {
  // State
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | 'all'>('all')
  const [assignedFilter, setAssignedFilter] = useState<string | 'all' | 'unassigned'>(currentUserId)
  const [sortOption, setSortOption] = useState<SortOption>('date-newest')

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)

  const router = useRouter()
  const searchParams = useSearchParams()

  // Handle opening ticket from URL parameter (e.g., from dashboard)
  useEffect(() => {
    const ticketId = searchParams.get('id')
    if (ticketId) {
      const ticket = tickets.find(t => t.id === ticketId)
      if (ticket) {
        setSelectedTicket(ticket)
        // Remove the query parameter after opening
        router.replace('/tickets', { scroll: false })
      }
    }
  }, [searchParams, tickets, router])

  // Filter and sort tickets
  const filteredTickets = useMemo(() => {
    let filtered = tickets

    // Status filter
    if (statusFilter === 'active') {
      filtered = filtered.filter(t => t.status !== 'archived')
    } else if (statusFilter === 'archived') {
      filtered = filtered.filter(t => t.status === 'archived')
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(t => t.priority === priorityFilter)
    }

    // Assignment filter
    if (assignedFilter === 'unassigned') {
      filtered = filtered.filter(t => !t.assigned_to)
    } else if (assignedFilter !== 'all') {
      filtered = filtered.filter(t => t.assigned_to === assignedFilter)
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query) ||
        t.company?.name.toLowerCase().includes(query) ||
        t.tags?.some(tag => tag.toLowerCase().includes(query))
      )
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      switch (sortOption) {
        case 'date-newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'date-oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case 'priority':
          const priorityOrder = { high: 0, medium: 1, low: 2 }
          return priorityOrder[a.priority] - priorityOrder[b.priority]
        case 'due-date':
          if (!a.due_date) return 1
          if (!b.due_date) return -1
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
        case 'title':
          return a.title.localeCompare(b.title)
        default:
          return 0
      }
    })

    return filtered
  }, [tickets, statusFilter, priorityFilter, assignedFilter, searchQuery, sortOption])

  // Stats
  const stats = useMemo(() => ({
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    inProgress: tickets.filter(t => t.status === 'in_progress').length,
    archived: tickets.filter(t => t.status === 'archived').length,
    overdue: tickets.filter(t =>
      t.due_date &&
      new Date(t.due_date) < new Date() &&
      t.status !== 'archived'
    ).length,
  }), [tickets])

  // Helper functions
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const isOverdue = (dueDate: string | null, status: TicketStatus) => {
    return dueDate && new Date(dueDate) < new Date() && status !== 'archived'
  }

  const getPriorityColor = (priority: TicketPriority) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-700'
      case 'medium':
        return 'bg-amber-100 text-amber-700'
      case 'low':
        return 'bg-gray-100 text-gray-700'
    }
  }

  const getStatusColor = (status: TicketStatus) => {
    switch (status) {
      case 'open':
        return 'bg-blue-100 text-blue-700'
      case 'in_progress':
        return 'bg-amber-100 text-amber-700'
      case 'archived':
        return 'bg-emerald-100 text-emerald-700'
    }
  }

  const getPartnerName = (partner: Partner | null | undefined) => {
    if (!partner) return 'Unassigned'
    if (partner.first_name && partner.last_name) {
      return `${partner.first_name} ${partner.last_name}`
    }
    return partner.email || 'Unknown'
  }

  // Render ticket card
  const renderTicketCard = (ticket: Ticket) => {
    const overdueStatus = isOverdue(ticket.due_date, ticket.status)

    return (
      <div
        key={ticket.id}
        onClick={() => setSelectedTicket(ticket)}
        className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow cursor-pointer"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-gray-900 truncate">
                {ticket.title}
              </h3>
              {ticket.comments && ticket.comments.length > 0 && (
                <div className="inline-flex items-center gap-1 text-xs text-gray-500" title={`${ticket.comments.length} comment${ticket.comments.length !== 1 ? 's' : ''}`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  {ticket.comments.length}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${getStatusColor(ticket.status)}`}>
                {ticket.status.replace('_', ' ')}
              </span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${getPriorityColor(ticket.priority)}`}>
                {ticket.priority}
              </span>
            </div>
          </div>
        </div>

        {/* Description preview */}
        {ticket.description && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {ticket.description}
          </p>
        )}

        {/* Company/Person */}
        {ticket.company && (
          <div className="flex items-center gap-2 mb-3">
            {ticket.company.logo_url && (
              <img src={ticket.company.logo_url} alt={ticket.company.name} className="w-5 h-5 rounded object-cover" />
            )}
            <span className="text-sm text-gray-600">{ticket.company.name}</span>
          </div>
        )}

        {/* Tags */}
        {ticket.tags && ticket.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {ticket.tags.map((tag, index) => (
              <span key={index} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            {ticket.assigned_partner?.avatar_url ? (
              <img src={ticket.assigned_partner.avatar_url} alt="" className="w-6 h-6 rounded-full" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                <span className="text-xs text-gray-600">
                  {ticket.assigned_partner?.first_name?.[0] || '?'}
                </span>
              </div>
            )}
            <span className="text-sm text-gray-600">
              {getPartnerName(ticket.assigned_partner)}
            </span>
          </div>
          {ticket.due_date && (
            <span className={`text-xs ${overdueStatus ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
              {overdueStatus ? 'Overdue' : formatDate(ticket.due_date)}
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header with stats */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Tickets</h1>
            <p className="mt-1 text-gray-500">Manage partner tasks and follow-ups</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Ticket
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Total" value={stats.total} color="gray" />
          <StatCard label="Open" value={stats.open} color="blue" />
          <StatCard label="In Progress" value={stats.inProgress} color="amber" />
          <StatCard label="Archived" value={stats.archived} color="green" />
          <StatCard label="Overdue" value={stats.overdue} color="red" />
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-col gap-4">
          {/* Search bar */}
          <input
            type="text"
            placeholder="Search tickets by title, description, company, or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
          />

          {/* Status tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'active'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Active ({stats.open + stats.inProgress})
            </button>
            <button
              onClick={() => setStatusFilter('archived')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'archived'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Archived ({stats.archived})
            </button>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'all'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({stats.total})
            </button>
          </div>

          {/* Filters row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as TicketPriority | 'all')}
              className="px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
            >
              <option value="all">All Priorities</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>

            <select
              value={assignedFilter}
              onChange={(e) => setAssignedFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
            >
              <option value="all">All Assignees</option>
              <option value="unassigned">Unassigned</option>
              {partners.map(partner => (
                <option key={partner.id} value={partner.id}>
                  {getPartnerName(partner)}
                </option>
              ))}
            </select>

            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
            >
              <option value="date-newest">Newest First</option>
              <option value="date-oldest">Oldest First</option>
              <option value="priority">Priority (High to Low)</option>
              <option value="due-date">Due Date</option>
              <option value="title">Title (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results count */}
      <div className="mb-4">
        <p className="text-sm text-gray-600">
          {filteredTickets.length} {filteredTickets.length === 1 ? 'ticket' : 'tickets'}
        </p>
      </div>

      {/* Tickets Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredTickets.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-gray-400 text-xl">🎫</span>
            </div>
            <p className="text-gray-600">No tickets found</p>
            <p className="text-sm text-gray-400 mt-1">
              {searchQuery || priorityFilter !== 'all' || assignedFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Create a ticket to get started'}
            </p>
          </div>
        ) : (
          filteredTickets.map(renderTicketCard)
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateTicketModal
          partners={partners}
          companies={companies}
          people={people}
          currentUserId={currentUserId}
          currentUserName={userName}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            router.refresh()
          }}
        />
      )}

      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          partners={partners}
          companies={companies}
          people={people}
          currentUserId={currentUserId}
          currentUserName={userName}
          onClose={() => setSelectedTicket(null)}
          onUpdate={() => {
            setSelectedTicket(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

// Helper component for stat cards
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorClasses: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-900',
    blue: 'bg-blue-100 text-blue-900',
    amber: 'bg-amber-100 text-amber-900',
    green: 'bg-emerald-100 text-emerald-900',
    red: 'bg-red-100 text-red-900',
  }

  return (
    <div className={`rounded-xl p-4 ${colorClasses[color] || colorClasses.gray}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm font-medium">{label}</div>
    </div>
  )
}
