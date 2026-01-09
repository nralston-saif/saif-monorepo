'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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
  company_name: string
  type: 'ready' | 'notes'
  updated_at?: string
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

export default function DashboardClient({
  needsVote,
  needsDecision,
  myActiveTickets,
  overdueTicketsCount,
  stats,
  notifications,
  userId,
}: {
  needsVote: NeedsVoteApp[]
  needsDecision: NeedsDecisionApp[]
  myActiveTickets: ActiveTicket[]
  overdueTicketsCount: number
  stats: Stats
  notifications: Notification[]
  userId: string
}) {
  const router = useRouter()
  const supabase = createClient()

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-gray-500">Your tasks at a glance</p>
      </div>

      {/* Top Row: Needs Your Vote + Needs Decision */}
      <div className="grid gap-8 lg:grid-cols-2 mb-8">
        {/* Needs Your Vote Section */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-amber-100 rounded-xl">
                <span className="text-amber-600 text-xl">⚡</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Needs Your Vote</h2>
                <p className="text-sm text-gray-500">{needsVote.length} application{needsVote.length !== 1 ? 's' : ''} waiting</p>
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {needsVote.length === 0 ? (
              <div className="p-6 text-center">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-emerald-600 text-xl">✓</span>
                </div>
                <p className="text-gray-600">You're all caught up!</p>
                <p className="text-sm text-gray-400">No pending votes</p>
              </div>
            ) : (
              needsVote.map((app) => (
                <Link
                  key={app.id}
                  href={`/pipeline#app-${app.id}`}
                  className="block p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">{app.company_name}</h3>
                      {app.founder_names && (
                        <p className="text-sm text-gray-500 truncate">{app.founder_names}</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
                      {formatDate(app.submitted_at)}
                    </span>
                  </div>
                  {app.company_description && (
                    <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                      {app.company_description}
                    </p>
                  )}
                </Link>
              ))
            )}
          </div>

          {needsVote.length > 0 && (
            <div className="p-4 bg-gray-50 border-t border-gray-100">
              <Link
                href="/pipeline"
                className="text-sm font-medium text-[#1a1a1a] hover:text-black"
              >
                View all in Pipeline →
              </Link>
            </div>
          )}
        </section>

        {/* Needs Decision Section */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-purple-100 rounded-xl">
                <span className="text-purple-600 text-xl">🤔</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Needs Decision</h2>
                <p className="text-sm text-gray-500">{needsDecision.length} in deliberation awaiting decision</p>
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {needsDecision.length === 0 ? (
              <div className="p-6 text-center">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-emerald-600 text-xl">✓</span>
                </div>
                <p className="text-gray-600">All decisions made!</p>
                <p className="text-sm text-gray-400">No pending deliberations</p>
              </div>
            ) : (
              needsDecision.map((app) => (
                <Link
                  key={app.id}
                  href={`/deliberation/${app.id}`}
                  className="block p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">{app.company_name}</h3>
                      {app.founder_names && (
                        <p className="text-sm text-gray-500 truncate">{app.founder_names}</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
                      {formatDate(app.submitted_at)}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>

          {needsDecision.length > 0 && (
            <div className="p-4 bg-gray-50 border-t border-gray-100">
              <Link
                href="/deliberation"
                className="text-sm font-medium text-[#1a1a1a] hover:text-black"
              >
                View all in Deliberation →
              </Link>
            </div>
          )}
        </section>
      </div>

      {/* Bottom Row: Notifications */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Notifications Section */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-xl">
                <span className="text-blue-600 text-xl">🔔</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
                <p className="text-sm text-gray-500">{notifications.length} update{notifications.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-100 flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-gray-400 text-xl">🔔</span>
                </div>
                <p className="text-gray-600">No notifications</p>
                <p className="text-sm text-gray-400">You're all caught up</p>
              </div>
            ) : (
              notifications.map((notif, i) => (
                <Link
                  key={`${notif.id}-${i}`}
                  href={notif.type === 'ready' ? `/pipeline#app-${notif.id}` : `/deliberation/${notif.id}`}
                  className="block p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg flex-shrink-0">
                      {notif.type === 'ready' ? '✅' : '📝'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">{notif.company_name}</h3>
                      <p className="text-sm text-gray-500">
                        {notif.type === 'ready' ? '3 votes - ready to advance' : 'New deliberation notes'}
                      </p>
                      {notif.updated_at && (
                        <p className="text-xs text-gray-400 mt-1">{formatTimeAgo(notif.updated_at)}</p>
                      )}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Third Row: To-do */}
      <div className="mt-8">
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-purple-100 rounded-xl">
                <span className="text-purple-600 text-xl">✓</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">My To-do</h2>
                <p className="text-sm text-gray-500">
                  {myActiveTickets.length} task{myActiveTickets.length !== 1 ? 's' : ''} assigned to you
                  {overdueTicketsCount > 0 && (
                    <span className="ml-2 text-red-600 font-medium">
                      {overdueTicketsCount} overdue
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {myActiveTickets.length === 0 ? (
              <div className="p-6 text-center">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-emerald-600 text-xl">✓</span>
                </div>
                <p className="text-gray-600">No tasks!</p>
                <p className="text-sm text-gray-400">All caught up</p>
              </div>
            ) : (
              myActiveTickets.map((ticket) => {
                const isOverdue = ticket.due_date && new Date(ticket.due_date) < new Date()
                const priorityColors: Record<string, string> = {
                  high: 'bg-red-100 text-red-700',
                  medium: 'bg-amber-100 text-amber-700',
                  low: 'bg-gray-100 text-gray-700',
                }

                return (
                  <Link
                    key={ticket.id}
                    href={`/tickets?id=${ticket.id}`}
                    className="block p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-gray-900 truncate">
                            {ticket.title}
                          </h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${priorityColors[ticket.priority as keyof typeof priorityColors] || priorityColors.medium}`}>
                            {ticket.priority}
                          </span>
                        </div>
                        {ticket.description && (
                          <p className="text-sm text-gray-600 line-clamp-2 mb-1">
                            {ticket.description}
                          </p>
                        )}
                        {ticket.tags && ticket.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-1">
                            {ticket.tags.map((tag, index) => (
                              <span
                                key={index}
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-700"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        {ticket.company && (
                          <p className="text-xs text-gray-500 truncate">
                            📁 {ticket.company.name}
                          </p>
                        )}
                      </div>
                      {ticket.due_date && (
                        <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg flex-shrink-0 ${isOverdue ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-xs font-medium whitespace-nowrap">
                            {isOverdue ? 'Overdue' : formatDate(ticket.due_date)}
                          </span>
                        </div>
                      )}
                    </div>
                  </Link>
                )
              })
            )}
          </div>

          {myActiveTickets.length > 0 && (
            <div className="p-4 bg-gray-50 border-t border-gray-100">
              <Link
                href="/tickets"
                className="text-sm font-medium text-[#1a1a1a] hover:text-black"
              >
                View all tickets →
              </Link>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
