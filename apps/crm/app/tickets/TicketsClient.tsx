'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { TicketStatus, TicketPriority, Ticket as BaseTicket, TicketComment as BaseTicketComment } from '@saif/supabase'
import CreateTicketModal from './CreateTicketModal'
import TicketDetailModal from './TicketDetailModal'
import { useTicketModal } from '@/components/TicketModalProvider'

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

type TicketCommentWithAuthor = BaseTicketComment & {
  author?: Partner | null
}

type TicketWithRelations = BaseTicket & {
  assigned_partner?: Partner | null
  creator?: Partner | null
  company?: Company | null
  person?: Person | null
  comments?: TicketCommentWithAuthor[]
}

type StatusFilter = 'active' | 'archived' | 'unassigned' | 'all'
type SortOption = 'date-newest' | 'date-oldest' | 'priority' | 'due-date' | 'title'

export default function TicketsClient({
  tickets,
  partners,
  companies,
  people,
  currentUserId,
  userName,
}: {
  tickets: TicketWithRelations[]
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
  const [selectedTicket, setSelectedTicket] = useState<TicketWithRelations | null>(null)
  const [localTickets, setLocalTickets] = useState<TicketWithRelations[]>(tickets)

  // Sync local tickets with prop changes
  useEffect(() => {
    setLocalTickets(tickets)
  }, [tickets])
  const [resolvingTicket, setResolvingTicket] = useState<{ id: string; title: string } | null>(null)
  const [resolveComment, setResolveComment] = useState('')
  const [isResolving, setIsResolving] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()
  const { setOnTicketUpdate } = useTicketModal()

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

  // Listen for ticket updates from modal (deletions)
  useEffect(() => {
    if (setOnTicketUpdate) {
      setOnTicketUpdate((ticketId, status) => {
        if (status === 'archived') {
          // Remove deleted ticket from list
          setLocalTickets(prev => prev.filter(t => t.id !== ticketId))
        }
      })
    }
    return () => {
      if (setOnTicketUpdate) {
        setOnTicketUpdate(null)
      }
    }
  }, [setOnTicketUpdate])

  // Filter and sort tickets
  const filteredTickets = useMemo(() => {
    let filtered = localTickets

    // Status filter
    if (statusFilter === 'active') {
      filtered = filtered.filter(t => t.status !== 'archived')
    } else if (statusFilter === 'archived') {
      filtered = filtered.filter(t => t.status === 'archived')
    } else if (statusFilter === 'unassigned') {
      filtered = filtered.filter(t => !t.assigned_to)
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
  }, [localTickets, statusFilter, priorityFilter, assignedFilter, searchQuery, sortOption])

  // Stats
  const stats = useMemo(() => ({
    total: localTickets.length,
    open: localTickets.filter(t => t.status === 'open').length,
    inProgress: localTickets.filter(t => t.status === 'in_progress').length,
    archived: localTickets.filter(t => t.status === 'archived').length,
    unassigned: localTickets.filter(t => !t.assigned_to).length,
    overdue: localTickets.filter(t =>
      t.due_date &&
      new Date(t.due_date) < new Date() &&
      t.status !== 'archived'
    ).length,
  }), [localTickets])

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

  const handleResolveClick = (ticketId: string, ticketTitle: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setResolvingTicket({ id: ticketId, title: ticketTitle })
    setResolveComment('')
  }

  const handleResolveSubmit = async () => {
    if (!resolvingTicket) return

    setIsResolving(true)
    const supabase = createClient()

    // Add comment if provided
    if (resolveComment.trim()) {
      await (supabase as any).from('saifcrm_ticket_comments').insert({
        ticket_id: resolvingTicket.id,
        author_id: currentUserId,
        content: resolveComment.trim(),
      })
    }

    // Archive the ticket
    const { error } = await supabase
      .from('saif_tickets')
      .update({ status: 'archived' })
      .eq('id', resolvingTicket.id)

    setIsResolving(false)
    setResolvingTicket(null)
    setResolveComment('')

    if (!error) {
      router.refresh()
    }
  }

  // Render ticket row (compact list view)
  const renderTicketCard = (ticket: TicketWithRelations) => {
    const overdueStatus = isOverdue(ticket.due_date, ticket.status)

    return (
      <div
        key={ticket.id}
        onClick={() => setSelectedTicket(ticket)}
        className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
      >
        <div className="flex items-start justify-between gap-4">
          {/* Left side - Main content */}
          <div className="flex-1 min-w-0">
            {/* Title, badges, and comment count */}
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="font-medium text-gray-900 truncate">
                {ticket.title}
              </h3>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(ticket.status)}`}>
                {ticket.status.replace('_', ' ')}
              </span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getPriorityColor(ticket.priority)}`}>
                {ticket.priority}
              </span>
              {ticket.comments && ticket.comments.length > 0 && (
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-xs text-gray-600" title={`${ticket.comments.length} comment${ticket.comments.length !== 1 ? 's' : ''}`}>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span>{ticket.comments.length}</span>
                </div>
              )}
            </div>

            {/* Description */}
            {ticket.description && (
              <p className="text-sm text-gray-600 line-clamp-1 mb-1.5">
                {ticket.description}
              </p>
            )}

            {/* Tags, Company, and Assigned person */}
            <div className="flex items-center gap-3 flex-wrap text-xs">
              {/* Tags */}
              {ticket.tags && ticket.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {ticket.tags.map((tag, index) => (
                    <span key={index} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Company */}
              {ticket.company && (
                <div className="flex items-center gap-1.5 text-gray-500">
                  {ticket.company.logo_url && (
                    <img src={ticket.company.logo_url} alt={ticket.company.name} className="w-4 h-4 rounded object-cover" />
                  )}
                  <span className="truncate">📁 {ticket.company.name}</span>
                </div>
              )}

              {/* Assigned to */}
              <div className="flex items-center gap-1.5 text-gray-500">
                {ticket.assigned_partner?.avatar_url ? (
                  <img src={ticket.assigned_partner.avatar_url} alt="" className="w-4 h-4 rounded-full" />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-[10px] text-gray-600">
                      {ticket.assigned_partner?.first_name?.[0] || '?'}
                    </span>
                  </div>
                )}
                <span className="truncate">👤 {getPartnerName(ticket.assigned_partner)}</span>
              </div>
            </div>
          </div>

          {/* Right side - Due date and actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {ticket.due_date && (
              <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg ${overdueStatus ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-xs font-medium whitespace-nowrap">
                  {overdueStatus ? 'Overdue' : formatDate(ticket.due_date)}
                </span>
              </div>
            )}
            {ticket.status !== 'archived' && (
              <button
                onClick={(e) => handleResolveClick(ticket.id, ticket.title, e)}
                className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                title="Resolve ticket"
              >
                Resolve
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tickets</h1>
          <p className="mt-1 text-gray-500">Manage partner tasks and follow-ups</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          + Create Ticket
        </button>
      </div>

      {/* Main Layout: Content Left, Stats Right */}
      <div className="flex gap-6">
        {/* Left side - Main content */}
        <div className="flex-1 min-w-0">

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
              onClick={() => {
                setStatusFilter('active')
                setAssignedFilter(currentUserId)
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'active'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Active ({stats.open + stats.inProgress})
            </button>
            <button
              onClick={() => {
                setStatusFilter('archived')
                setAssignedFilter('all')
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'archived'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Archived ({stats.archived})
            </button>
            <button
              onClick={() => {
                setStatusFilter('unassigned')
                setAssignedFilter('unassigned')
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'unassigned'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Unassigned ({stats.unassigned})
            </button>
            <button
              onClick={() => {
                setStatusFilter('all')
                setAssignedFilter('all')
              }}
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

      {/* Tickets List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filteredTickets.length === 0 ? (
          <div className="text-center py-12">
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
          <div className="divide-y divide-gray-100">
            {filteredTickets.map(renderTicketCard)}
          </div>
        )}
      </div>
        </div>

        {/* Right side - Stats */}
        <div className="w-48 flex-shrink-0">
          <div className="sticky top-6 flex flex-col gap-3">
            <StatCard label="Total" value={stats.total} color="gray" />
            <StatCard label="Open" value={stats.open} color="blue" />
            <StatCard label="In Progress" value={stats.inProgress} color="amber" />
            <StatCard label="Archived" value={stats.archived} color="green" />
            <StatCard label="Overdue" value={stats.overdue} color="red" />
          </div>
        </div>
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

      {/* Resolve Ticket Modal */}
      {resolvingTicket && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setResolvingTicket(null)}
          />

          {/* Modal */}
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.3)] z-[60] border-2 border-gray-200">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Resolve Ticket
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {resolvingTicket.title}
              </p>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Final Comment (Optional)
              </label>
              <textarea
                value={resolveComment}
                onChange={(e) => setResolveComment(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-sm"
                rows={4}
                placeholder="Add any final notes before resolving..."
                autoFocus
              />
              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  onClick={() => setResolvingTicket(null)}
                  disabled={isResolving}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResolveSubmit}
                  disabled={isResolving}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isResolving ? 'Resolving...' : 'Resolve Ticket'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket as any}
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
    <div className={`rounded-lg p-3 ${colorClasses[color] || colorClasses.gray}`}>
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs font-medium">{label}</div>
    </div>
  )
}
