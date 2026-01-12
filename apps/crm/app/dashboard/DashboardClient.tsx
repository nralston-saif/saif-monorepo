'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTicketModal } from '@/components/TicketModalProvider'
import type { NotificationType } from '@/lib/types/database'
import CreateTicketButton from '@/components/CreateTicketButton'

type NeedsVoteApp = {
  id: string
  company_name: string
  founder_names: string | null
  company_description: string | null
  submitted_at: string | null
}

type NeedsDecisionApp = {
  id: string
  company_name: string
  founder_names: string | null
  submitted_at: string | null
}

type Stats = {
  pipeline: number
  deliberation: number
  invested: number
  rejected: number
}

type Notification = {
  id: string
  type: NotificationType
  title: string
  message: string | null
  link: string | null
  application_id: string | null
  ticket_id: string | null
  read_at: string | null
  created_at: string
  actor_name: string | null
}

type ActiveTicket = {
  id: string
  title: string
  description: string | null
  priority: string
  due_date: string | null
  status: string
  tags: string[] | null
  company: { name: string } | null
}

type PortfolioStats = {
  totalInvestments: number
  totalInvested: number
  averageCheck: number
}

export default function DashboardClient({
  needsVote,
  needsDecision,
  myActiveTickets = [],
  overdueTicketsCount,
  stats,
  portfolioStats,
  notifications: initialNotifications,
  userId,
}: {
  needsVote: NeedsVoteApp[]
  needsDecision: NeedsDecisionApp[]
  myActiveTickets: ActiveTicket[]
  overdueTicketsCount: number
  stats: Stats
  portfolioStats: PortfolioStats
  notifications: Notification[]
  userId: string
}) {
  const router = useRouter()
  const supabase = createClient()
  const { openTicket, setOnTicketUpdate } = useTicketModal()
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications)
  const [dismissingId, setDismissingId] = useState<string | null>(null)
  const [resolvingTicket, setResolvingTicket] = useState<{ id: string; title: string } | null>(null)
  const [resolveComment, setResolveComment] = useState('')
  const [isResolving, setIsResolving] = useState(false)
  const [activeTickets, setActiveTickets] = useState<ActiveTicket[]>(myActiveTickets)

  // Sync tickets state with prop changes (e.g., after creating new ticket)
  useEffect(() => {
    setActiveTickets(myActiveTickets)
  }, [myActiveTickets])

  // Listen for ticket updates from modal
  useEffect(() => {
    if (setOnTicketUpdate) {
      setOnTicketUpdate((ticketId, status) => {
        if (status === 'archived') {
          // Remove archived ticket from active tickets list
          setActiveTickets(prev => prev.filter(t => t.id !== ticketId))
        }
      })
    }

    return () => {
      if (setOnTicketUpdate) {
        setOnTicketUpdate(null)
      }
    }
  }, [setOnTicketUpdate])

  // Check if notification is ticket-related
  const isTicketNotification = (type: NotificationType): boolean => {
    return type === 'ticket_assigned' || type === 'ticket_archived' || type === 'ticket_status_changed'
  }

  // Fetch notifications helper
  const fetchNotifications = useCallback(async () => {
    const { data } = await supabase
      .from('saifcrm_notifications')
      .select(`
        id,
        type,
        title,
        message,
        link,
        application_id,
        ticket_id,
        read_at,
        created_at,
        actor:actor_id(name, first_name, last_name)
      `)
      .is('dismissed_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(20)

    if (data) {
      setNotifications(
        data.map((n: any) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          link: n.link,
          application_id: n.application_id,
          ticket_id: n.ticket_id,
          read_at: n.read_at,
          created_at: n.created_at,
          actor_name: n.actor?.first_name && n.actor?.last_name
            ? `${n.actor.first_name} ${n.actor.last_name}`
            : n.actor?.name || null,
        }))
      )
    }
  }, [supabase])

  // Real-time subscription for notifications
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'saifcrm_notifications',
        },
        () => {
          // Refetch notifications on any change
          fetchNotifications()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, fetchNotifications])

  // Dismiss notification
  const handleDismiss = async (notificationId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDismissingId(notificationId)

    const { error } = await supabase
      .from('saifcrm_notifications')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('id', notificationId)

    if (!error) {
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId))
    }
    setDismissingId(null)
  }

  // Handle notification click - opens modal for tickets, navigates for others
  const handleNotificationClick = async (notif: Notification) => {
    // Mark as read in background (don't await)
    supabase
      .from('saifcrm_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notif.id)
      .is('read_at', null)
      .then(() => {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notif.id ? { ...n, read_at: new Date().toISOString() } : n
          )
        )
      })

    // For ticket notifications, open modal instead of navigating
    if (isTicketNotification(notif.type) && notif.ticket_id) {
      openTicket(notif.ticket_id)
    } else if (notif.link) {
      router.push(notif.link)
    }
  }

  // Get notification icon based on type
  const getNotificationIcon = (type: NotificationType): string => {
    switch (type) {
      case 'new_application':
        return '📥'
      case 'ready_for_deliberation':
        return '✅'
      case 'new_deliberation_notes':
        return '📝'
      case 'decision_made':
        return '🎯'
      case 'ticket_assigned':
        return '🎫'
      case 'ticket_archived':
        return '📦'
      case 'ticket_status_changed':
        return '🔄'
      default:
        return '🔔'
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  const handleResolveClick = (ticketId: string, ticketTitle: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setResolvingTicket({ id: ticketId, title: ticketTitle })
    setResolveComment('')
  }

  const handleResolveSubmit = async () => {
    if (!resolvingTicket) return

    const ticketId = resolvingTicket.id

    // Optimistically remove ticket from UI immediately
    setActiveTickets(prevTickets => prevTickets.filter(t => t.id !== ticketId))
    setResolvingTicket(null)
    setResolveComment('')

    // Make API calls in background
    if (resolveComment.trim()) {
      await (supabase as any).from('saifcrm_ticket_comments').insert({
        ticket_id: ticketId,
        author_id: userId,
        content: resolveComment.trim(),
      })
    }

    // Archive the ticket
    const { error } = await supabase
      .from('saif_tickets')
      .update({ status: 'archived' })
      .eq('id', ticketId)

    // Refresh in background to sync data (only if error to restore correct state)
    if (error) {
      router.refresh()
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`
    }
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}K`
    }
    return `$${amount.toFixed(0)}`
  }

  return (
    <div className="mx-auto px-4 py-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        </div>
        <CreateTicketButton
          currentUserId={userId}
          onSuccess={() => router.refresh()}
        />
      </div>

      {/* Portfolio Stats */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 px-3 py-2 flex items-center gap-2">
          <span className="text-lg">📊</span>
          <div>
            <p className="text-xs text-gray-500">Investments</p>
            <p className="text-lg font-bold text-gray-900">{portfolioStats.totalInvestments}</p>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 px-3 py-2 flex items-center gap-2">
          <span className="text-lg">💰</span>
          <div>
            <p className="text-xs text-gray-500">Total Invested</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(portfolioStats.totalInvested)}</p>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 px-3 py-2 flex items-center gap-2">
          <span className="text-lg">📝</span>
          <div>
            <p className="text-xs text-gray-500">Avg Check</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(portfolioStats.averageCheck)}</p>
          </div>
        </div>
      </div>

      {/* 2x2 Grid */}
      <div className="grid gap-3 sm:grid-cols-2 mb-3">
        {/* Needs Your Vote Section */}
        <section className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-amber-600 text-sm">⚡</span>
              <h2 className="text-sm font-semibold text-gray-900">Needs Your Vote</h2>
            </div>
            <span className="text-xs text-gray-400">{needsVote.length}</span>
          </div>

          <div className="divide-y divide-gray-100 max-h-40 overflow-y-auto">
            {needsVote.length === 0 ? (
              <div className="p-3 text-center text-sm text-gray-500">All caught up!</div>
            ) : (
              needsVote.map((app) => (
                <Link
                  key={app.id}
                  href={`/pipeline#app-${app.id}`}
                  className="block px-3 py-2 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 truncate">{app.company_name}</span>
                    {app.submitted_at && (
                      <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
                        {formatDate(app.submitted_at)}
                      </span>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>

          {needsVote.length > 0 && (
            <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-100">
              <Link href="/pipeline" className="text-xs text-gray-500 hover:text-gray-900">
                View all →
              </Link>
            </div>
          )}
        </section>

        {/* Needs Decision Section */}
        <section className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-purple-600 text-sm">🤔</span>
              <h2 className="text-sm font-semibold text-gray-900">Needs Decision</h2>
            </div>
            <span className="text-xs text-gray-400">{needsDecision.length}</span>
          </div>

          <div className="divide-y divide-gray-100 max-h-40 overflow-y-auto">
            {needsDecision.length === 0 ? (
              <div className="p-3 text-center text-sm text-gray-500">All decisions made!</div>
            ) : (
              needsDecision.map((app) => (
                <Link
                  key={app.id}
                  href={`/deliberation/${app.id}`}
                  className="block px-3 py-2 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 truncate">{app.company_name}</span>
                    {app.submitted_at && (
                      <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
                        {formatDate(app.submitted_at)}
                      </span>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>

          {needsDecision.length > 0 && (
            <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-100">
              <Link href="/deliberation" className="text-xs text-gray-500 hover:text-gray-900">
                View all →
              </Link>
            </div>
          )}
        </section>

        {/* Notifications Section */}
        <section className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-blue-600 text-sm">🔔</span>
              <h2 className="text-sm font-semibold text-gray-900">Notifications</h2>
            </div>
            {notifications.filter(n => !n.read_at).length > 0 ? (
              <span className="text-xs text-blue-600 font-medium">{notifications.filter(n => !n.read_at).length} new</span>
            ) : (
              <span className="text-xs text-gray-400">{notifications.length}</span>
            )}
          </div>

          <div className="divide-y divide-gray-100 max-h-40 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-3 text-center text-sm text-gray-500">No notifications</div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`relative group ${!notif.read_at ? 'bg-blue-50/50' : ''}`}
                >
                  <div
                    onClick={() => handleNotificationClick(notif)}
                    className="block px-3 py-2 hover:bg-gray-50 transition-colors pr-8 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm flex-shrink-0">{getNotificationIcon(notif.type)}</span>
                      <span className={`text-sm truncate ${!notif.read_at ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                        {notif.title}
                      </span>
                      {!notif.read_at && (
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0" />
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDismiss(notif.id, e)}
                    disabled={dismissingId === notif.id}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* My To-do Section */}
        <section className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-green-600 text-sm">✓</span>
              <h2 className="text-sm font-semibold text-gray-900">My To-do</h2>
            </div>
            {overdueTicketsCount > 0 ? (
              <span className="text-xs text-red-600 font-medium">{overdueTicketsCount} overdue</span>
            ) : (
              <span className="text-xs text-gray-400">{activeTickets.length}</span>
            )}
          </div>

          <div className="divide-y divide-gray-100 max-h-40 overflow-y-auto">
            {activeTickets.length === 0 ? (
              <div className="p-3 text-center text-sm text-gray-500">No tasks!</div>
            ) : (
              activeTickets.map((ticket) => {
                const isOverdue = ticket.due_date && new Date(ticket.due_date) < new Date()
                return (
                  <div
                    key={ticket.id}
                    onClick={() => openTicket(ticket.id)}
                    className="block px-3 py-2 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">{ticket.title}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isOverdue && <span className="text-xs text-red-600">Overdue</span>}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleResolveClick(ticket.id, ticket.title, e)
                          }}
                          className="px-1.5 py-0.5 text-xs text-green-700 bg-green-50 hover:bg-green-100 rounded transition-colors"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {activeTickets.length > 0 && (
            <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-100">
              <Link href="/tickets" className="text-xs text-gray-500 hover:text-gray-900">
                View all →
              </Link>
            </div>
          )}
        </section>
      </div>

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
    </div>
  )
}
