'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useToast } from '@saif/ui'
import CreateTicketButton from '@/components/CreateTicketButton'
import ApplicationDetailModal from '@/components/ApplicationDetailModal'

// ============================================
// Types
// ============================================

type Vote = {
  oduserId: string
  userName: string
  vote: string
  notes: string | null
}

type BaseApplication = {
  id: string
  company_name: string
  founder_names: string | null
  founder_linkedins: string | null
  founder_bios: string | null
  primary_email: string | null
  company_description: string | null
  website: string | null
  previous_funding: string | null
  deck_link: string | null
  submitted_at: string | null
}

type VotingApplication = BaseApplication & {
  voteCount: number
  userVote?: string | null
  userNotes?: string | null
  votes_revealed: boolean | null
  allVotes: Vote[]
}

type Deliberation = {
  id: string
  meeting_date: string | null
  idea_summary: string | null
  thoughts: string | null
  decision: string
  status: string | null
} | null

type DeliberationApplication = BaseApplication & {
  stage: string | null
  votes: Vote[]
  voteCount: number
  allVotes: Vote[]
  deliberation: Deliberation
  email_sent: boolean | null
  email_sender_name: string | null
}

type ArchivedApplication = BaseApplication & {
  stage: string | null
  email_sent: boolean | null
  email_sender_name: string | null
  allVotes: Vote[]
  draft_rejection_email: string | null
}

type Partner = {
  id: string
  name: string | null
}

type Tab = 'voting' | 'deliberation' | 'archive'

type EmailSenderModal = {
  app: VotingApplication
  action: 'deliberation' | 'reject'
} | null

type SortOption =
  | 'date-newest'
  | 'date-oldest'
  | 'name-az'
  | 'name-za'
  | 'stage'
  | 'decision-yes'
  | 'decision-no'

// ============================================
// Helper Functions
// ============================================

function formatDate(dateString: string | null): string {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function getVoteBadgeStyle(voteValue: string): string {
  switch (voteValue) {
    case 'yes':
      return 'badge-success'
    case 'maybe':
      return 'badge-warning'
    case 'no':
      return 'badge-danger'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

function getStageBadgeStyle(stage: string | null): string {
  if (!stage) return 'bg-gray-100 text-gray-700'
  switch (stage) {
    case 'invested':
      return 'bg-emerald-100 text-emerald-700'
    case 'deliberation':
      return 'bg-amber-100 text-amber-700'
    case 'rejected':
      return 'bg-red-100 text-red-700'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

function getDecisionBadgeStyle(decision: string): string {
  switch (decision) {
    case 'yes':
      return 'bg-emerald-500 text-white'
    case 'no':
      return 'bg-red-500 text-white'
    case 'maybe':
      return 'bg-amber-500 text-white'
    default:
      return 'bg-gray-200 text-gray-700'
  }
}

function getStatusBadgeStyle(status: string): string {
  switch (status) {
    case 'invested':
      return 'badge-success'
    case 'rejected':
      return 'badge-danger'
    case 'met':
      return 'badge-info'
    case 'emailed':
      return 'badge-purple'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

function sortByDateAndName<
  T extends { submitted_at: string | null; company_name: string; stage?: string | null }
>(items: T[], sortOption: SortOption, getDecision?: (item: T) => string | undefined): T[] {
  return [...items].sort((a, b) => {
    switch (sortOption) {
      case 'date-newest': {
        const dateA = a.submitted_at ? new Date(a.submitted_at).getTime() : 0
        const dateB = b.submitted_at ? new Date(b.submitted_at).getTime() : 0
        return dateB - dateA
      }
      case 'date-oldest': {
        const dateA = a.submitted_at ? new Date(a.submitted_at).getTime() : 0
        const dateB = b.submitted_at ? new Date(b.submitted_at).getTime() : 0
        return dateA - dateB
      }
      case 'name-az':
        return a.company_name.localeCompare(b.company_name)
      case 'name-za':
        return b.company_name.localeCompare(a.company_name)
      case 'stage':
        return (a.stage || '').localeCompare(b.stage || '')
      case 'decision-yes':
        if (getDecision) {
          if (getDecision(a) === 'yes' && getDecision(b) !== 'yes') return -1
          if (getDecision(a) !== 'yes' && getDecision(b) === 'yes') return 1
        }
        return 0
      case 'decision-no':
        if (getDecision) {
          if (getDecision(a) === 'no' && getDecision(b) !== 'no') return -1
          if (getDecision(a) !== 'no' && getDecision(b) === 'no') return 1
        }
        return 0
      default:
        return 0
    }
  })
}

function filterBySearchQuery<
  T extends {
    company_name: string
    founder_names: string | null
    company_description: string | null
  }
>(items: T[], query: string): T[] {
  if (!query.trim()) return items
  const lowerQuery = query.toLowerCase()
  return items.filter(
    (app) =>
      app.company_name.toLowerCase().includes(lowerQuery) ||
      app.founder_names?.toLowerCase().includes(lowerQuery) ||
      app.company_description?.toLowerCase().includes(lowerQuery)
  )
}

// ============================================
// SVG Icons
// ============================================

function CloseIcon(): React.ReactElement {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  )
}

function SearchIcon(): React.ReactElement {
  return (
    <svg
      className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  )
}

function SpinnerIcon({ className = 'h-4 w-4' }: { className?: string }): React.ReactElement {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

function DotsMenuIcon(): React.ReactElement {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
      <circle cx="8" cy="2.5" r="1.5" />
      <circle cx="8" cy="8" r="1.5" />
      <circle cx="8" cy="13.5" r="1.5" />
    </svg>
  )
}

function EditIcon(): React.ReactElement {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
      />
    </svg>
  )
}

function CopyIcon(): React.ReactElement {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  )
}

function LinkedInIcon(): React.ReactElement {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
    </svg>
  )
}

// ============================================
// Component Props
// ============================================

type DealsClientProps = {
  votingApplications: VotingApplication[]
  undecidedDeliberations: DeliberationApplication[]
  decidedDeliberations: DeliberationApplication[]
  archivedApplications: ArchivedApplication[]
  userId: string
  partners: Partner[]
}

// ============================================
// Component
// ============================================

export default function DealsClient({
  votingApplications,
  undecidedDeliberations,
  decidedDeliberations,
  archivedApplications,
  userId,
  partners,
}: DealsClientProps): React.ReactElement {
  const searchParams = useSearchParams()
  const initialTab = (searchParams.get('tab') as Tab) || 'voting'

  const [activeTab, setActiveTab] = useState<Tab>(initialTab)
  const [clientVotingApps, setClientVotingApps] =
    useState<VotingApplication[]>(votingApplications)

  // Voting tab state
  const [selectedVoteApp, setSelectedVoteApp] = useState<VotingApplication | null>(null)
  const [vote, setVote] = useState<string>('')
  const [voteNotes, setVoteNotes] = useState<string>('')
  const [voteLoading, setVoteLoading] = useState(false)
  const [movingToDelib, setMovingToDelib] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [confirmMoveApp, setConfirmMoveApp] = useState<VotingApplication | null>(null)
  const [emailSenderModal, setEmailSenderModal] = useState<EmailSenderModal>(null)
  const [selectedEmailSender, setSelectedEmailSender] = useState<string>('')

  // Deliberation tab state
  const [selectedDelibApp, setSelectedDelibApp] = useState<DeliberationApplication | null>(
    null
  )
  const [ideaSummary, setIdeaSummary] = useState('')
  const [thoughts, setThoughts] = useState('')
  const [decision, setDecision] = useState('pending')
  const [status, setStatus] = useState('scheduled')
  const [meetingDate, setMeetingDate] = useState('')
  const [delibLoading, setDelibLoading] = useState(false)
  const [investmentAmount, setInvestmentAmount] = useState<number | null>(null)
  const [investmentTerms, setInvestmentTerms] = useState('')
  const [investmentDate, setInvestmentDate] = useState('')
  const [otherFunders, setOtherFunders] = useState('')

  // Detail modals
  const [detailVotingApp, setDetailVotingApp] = useState<VotingApplication | null>(null)
  const [detailDelibApp, setDetailDelibApp] = useState<DeliberationApplication | null>(null)
  const [detailArchivedApp, setDetailArchivedApp] = useState<ArchivedApplication | null>(null)

  // Search state
  const [archiveSearchQuery, setArchiveSearchQuery] = useState('')
  const [archiveSortOption, setArchiveSortOption] = useState<SortOption>('date-newest')
  const [delibSearchQuery, setDelibSearchQuery] = useState('')
  const [delibSortOption, setDelibSortOption] = useState<SortOption>('date-newest')

  // Rejection email state
  const [editingEmail, setEditingEmail] = useState<string>('')
  const [savingEmail, setSavingEmail] = useState(false)
  const [generatingEmail, setGeneratingEmail] = useState<string | null>(null)

  const router = useRouter()
  const supabase = createClient()
  const { showToast } = useToast()

  useEffect(() => {
    setClientVotingApps(votingApplications)
  }, [votingApplications])

  const appIdsRef = useRef<string[]>([])
  useEffect(() => {
    appIdsRef.current = clientVotingApps.map((app) => app.id)
  }, [clientVotingApps])

  const fetchVotesAndUpdateApplications = useCallback(async () => {
    const appIds = appIdsRef.current
    if (appIds.length === 0) return

    const { data: votes, error } = await supabase
      .from('saifcrm_votes')
      .select('id, application_id, vote, user_id, notes, vote_type, saif_people(name)')
      .in('application_id', appIds)
      .eq('vote_type', 'initial')

    if (error) {
      console.error('Error fetching votes:', error)
      return
    }

    const votesByApp: Record<string, typeof votes> = {}
    votes?.forEach((voteRecord) => {
      if (!votesByApp[voteRecord.application_id]) {
        votesByApp[voteRecord.application_id] = []
      }
      votesByApp[voteRecord.application_id].push(voteRecord)
    })

    setClientVotingApps((prevApps) =>
      prevApps.map((app) => {
        const appVotes = votesByApp[app.id] || []
        const userVoteRecord = appVotes.find((v) => v.user_id === userId)

        return {
          ...app,
          voteCount: appVotes.length,
          userVote: userVoteRecord?.vote || null,
          userNotes: userVoteRecord?.notes || null,
          allVotes: appVotes.map((v) => ({
            oduserId: v.user_id,
            userName: (v.saif_people as { name: string } | null)?.name || 'Unknown',
            vote: v.vote || '',
            notes: v.notes,
          })),
        }
      })
    )
  }, [supabase, userId])

  useEffect(() => {
    const channel = supabase
      .channel('deals-votes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'saifcrm_votes',
        },
        (payload) => {
          const newRecord = payload.new as { application_id?: string } | null
          const oldRecord = payload.old as { application_id?: string } | null
          const affectedAppId = newRecord?.application_id || oldRecord?.application_id
          if (affectedAppId && appIdsRef.current.includes(affectedAppId)) {
            fetchVotesAndUpdateApplications()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, fetchVotesAndUpdateApplications])

  // ============================================
  // Voting Tab Handlers
  // ============================================

  const needsYourVote = clientVotingApps.filter((app) => !app.userVote)
  const alreadyVoted = clientVotingApps.filter((app) => app.userVote)

  async function handleVoteSubmit(): Promise<void> {
    if (!selectedVoteApp || !vote) return

    setVoteLoading(true)

    try {
      const { error } = await supabase.from('saifcrm_votes').upsert(
        {
          application_id: selectedVoteApp.id,
          user_id: userId,
          vote_type: 'initial',
          vote,
          notes: voteNotes || null,
        },
        {
          onConflict: 'application_id,user_id,vote_type',
        }
      )

      if (error) {
        showToast('Error submitting vote: ' + error.message, 'error')
        setVoteLoading(false)
        return
      }

      if (selectedVoteApp.voteCount === 0) {
        await supabase
          .from('saifcrm_applications')
          .update({ stage: 'voting' })
          .eq('id', selectedVoteApp.id)
      }

      fetch('/api/notifications/check-votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: selectedVoteApp.id,
          voterId: userId,
        }),
      }).catch(console.error)

      setSelectedVoteApp(null)
      setVote('')
      setVoteNotes('')
      showToast('Vote submitted successfully', 'success')
      router.refresh()
    } catch {
      showToast('An unexpected error occurred', 'error')
    }

    setVoteLoading(false)
  }

  function promptMoveToDeliberation(app: VotingApplication): void {
    setEmailSenderModal({ app, action: 'deliberation' })
    setSelectedEmailSender('')
  }

  function promptReject(app: VotingApplication): void {
    setEmailSenderModal({ app, action: 'reject' })
    setSelectedEmailSender('')
  }

  async function handleEmailSenderConfirm(): Promise<void> {
    if (!emailSenderModal || !selectedEmailSender) return

    const { app, action } = emailSenderModal
    setMovingToDelib(app.id)

    try {
      const newStage = action === 'deliberation' ? 'deliberation' : 'rejected'

      const { error } = await supabase
        .from('saifcrm_applications')
        .update({
          stage: newStage,
          votes_revealed: true,
          email_sender_id: selectedEmailSender,
          email_sent: false,
        })
        .eq('id', app.id)

      if (error) {
        showToast(`Error: ${error.message}`, 'error')
        setMovingToDelib(null)
        return
      }

      const stageLabel = action === 'deliberation' ? 'deliberation' : 'rejection'
      const emailType = action === 'deliberation' ? 'ACCEPT' : 'REJECT'
      await supabase.from('saif_tickets').insert({
        title: `Send ${emailType} email to ${app.company_name}`,
        description: `Send ${stageLabel} follow-up email to ${app.company_name}${app.primary_email ? ` (${app.primary_email})` : ''}${app.founder_names ? `\n\nFounders: ${app.founder_names}` : ''}\n\nEmail type: ${emailType}`,
        status: 'open',
        priority: 'medium',
        assigned_to: selectedEmailSender,
        created_by: userId,
        tags: ['email-follow-up', newStage],
      })

      const message =
        action === 'deliberation' ? 'Moved to deliberation' : 'Marked as rejected'
      showToast(message, 'success')
      setEmailSenderModal(null)

      if (action === 'reject') {
        showToast('Generating rejection email...', 'success')
        generateRejectionEmail(app.id)
      }

      router.refresh()
    } catch {
      showToast('An unexpected error occurred', 'error')
    }

    setMovingToDelib(null)
  }

  async function handleMoveToDeliberationWithoutVoting(): Promise<void> {
    if (!confirmMoveApp) return

    setMovingToDelib(confirmMoveApp.id)

    try {
      const { error } = await supabase
        .from('saifcrm_applications')
        .update({
          stage: 'deliberation',
          votes_revealed: true,
        })
        .eq('id', confirmMoveApp.id)

      if (error) {
        showToast('Error moving to deliberation: ' + error.message, 'error')
        setMovingToDelib(null)
        setConfirmMoveApp(null)
        return
      }

      setConfirmMoveApp(null)
      setOpenMenuId(null)
      showToast('Moved to deliberation', 'success')
      router.refresh()
    } catch {
      showToast('An unexpected error occurred', 'error')
    }

    setMovingToDelib(null)
  }

  // ============================================
  // Deliberation Tab Handlers
  // ============================================

  const filteredDecidedDeliberations = useMemo(() => {
    const filtered = filterBySearchQuery(decidedDeliberations, delibSearchQuery)
    return sortByDateAndName(filtered, delibSortOption, (app) => app.deliberation?.decision)
  }, [decidedDeliberations, delibSearchQuery, delibSortOption])

  function openDeliberationModal(app: DeliberationApplication): void {
    setSelectedDelibApp(app)
    setIdeaSummary(app.deliberation?.idea_summary || '')
    setThoughts(app.deliberation?.thoughts || '')
    setDecision(app.deliberation?.decision || 'pending')
    setStatus(app.deliberation?.status || 'scheduled')
    setMeetingDate(app.deliberation?.meeting_date || '')
    setInvestmentAmount(null)
    setInvestmentTerms('10mm cap safe')
    setInvestmentDate(new Date().toISOString().split('T')[0])
    setOtherFunders('')
  }

  async function handleSaveDeliberation(): Promise<void> {
    if (!selectedDelibApp) return

    if (decision === 'yes') {
      if (!investmentAmount || investmentAmount <= 0) {
        showToast('Please enter an investment amount', 'warning')
        return
      }
      if (!investmentTerms) {
        showToast('Please enter investment terms', 'warning')
        return
      }
      if (!investmentDate) {
        showToast('Please enter an investment date', 'warning')
        return
      }
    }

    setDelibLoading(true)

    try {
      const { error } = await supabase.from('saifcrm_deliberations').upsert(
        {
          application_id: selectedDelibApp.id,
          idea_summary: ideaSummary || null,
          thoughts: thoughts || null,
          decision: decision as 'pending' | 'maybe' | 'yes' | 'no',
          status: decision === 'yes' ? 'invested' : status,
          meeting_date: meetingDate || null,
        },
        {
          onConflict: 'application_id',
        }
      )

      if (error) {
        showToast('Error saving deliberation: ' + error.message, 'error')
        setDelibLoading(false)
        return
      }

      if (decision === 'yes') {
        const { error: investmentError } = await supabase.from('saifcrm_investments').insert({
          company_name: selectedDelibApp.company_name,
          investment_date: investmentDate,
          amount: investmentAmount,
          terms: investmentTerms,
          other_funders: otherFunders || null,
          founders: selectedDelibApp.founder_names,
          description: ideaSummary || selectedDelibApp.company_description,
          website: selectedDelibApp.website,
          contact_email: selectedDelibApp.primary_email,
          contact_name: null,
          stealthy: false,
          notes: thoughts || null,
        })

        if (investmentError) {
          showToast('Error creating investment: ' + investmentError.message, 'error')
          setDelibLoading(false)
          return
        }

        await supabase
          .from('saifcrm_applications')
          .update({ stage: 'invested' })
          .eq('id', selectedDelibApp.id)
      } else if (decision === 'no') {
        await supabase
          .from('saifcrm_applications')
          .update({ stage: 'rejected' })
          .eq('id', selectedDelibApp.id)
      }

      setSelectedDelibApp(null)

      if (decision === 'yes') {
        showToast('Investment recorded and added to portfolio', 'success')
      } else if (decision === 'no') {
        showToast('Application marked as rejected', 'success')
      } else {
        showToast('Deliberation saved', 'success')
      }

      router.refresh()
    } catch {
      showToast('An unexpected error occurred', 'error')
    }

    setDelibLoading(false)
  }

  // ============================================
  // Archive Tab Handlers
  // ============================================

  const filteredArchivedApplications = useMemo(() => {
    const filtered = filterBySearchQuery(archivedApplications, archiveSearchQuery)
    return sortByDateAndName(filtered, archiveSortOption)
  }, [archivedApplications, archiveSearchQuery, archiveSortOption])

  // ============================================
  // Shared Helpers
  // ============================================

  async function generateRejectionEmail(applicationId: string): Promise<void> {
    setGeneratingEmail(applicationId)
    try {
      const response = await fetch('/api/generate-rejection-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        showToast(`Failed to generate email: ${errorData.error}`, 'error')
        return
      }

      showToast('Rejection email generated!', 'success')
      router.refresh()
    } catch {
      showToast('Failed to generate rejection email', 'error')
    } finally {
      setGeneratingEmail(null)
    }
  }

  async function saveEditedEmail(applicationId: string, email: string): Promise<void> {
    setSavingEmail(true)
    try {
      const response = await fetch('/api/generate-rejection-email', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId, email }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        showToast(`Failed to save email: ${errorData.error}`, 'error')
        return
      }

      showToast('Email saved!', 'success')
      router.refresh()
    } catch {
      showToast('Failed to save email', 'error')
    } finally {
      setSavingEmail(false)
    }
  }

  async function copyToClipboard(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text)
      showToast('Copied to clipboard!', 'success')
    } catch {
      showToast('Failed to copy', 'error')
    }
  }

  function getVoteButtonStyle(option: string): string {
    const isSelected = vote === option
    const baseClasses =
      'flex-1 py-4 px-4 rounded-xl border-2 font-semibold text-center transition-all cursor-pointer'

    if (isSelected) {
      if (option === 'yes')
        return `${baseClasses} border-emerald-500 bg-emerald-50 text-emerald-700 shadow-md`
      if (option === 'maybe')
        return `${baseClasses} border-amber-500 bg-amber-50 text-amber-700 shadow-md`
      if (option === 'no')
        return `${baseClasses} border-red-500 bg-red-50 text-red-700 shadow-md`
    }
    return `${baseClasses} border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50`
  }

  // ============================================
  // Tab Counts
  // ============================================

  const votingCount = clientVotingApps.length
  const deliberationCount = undecidedDeliberations.length
  const archiveCount = archivedApplications.length

  // ============================================
  // Render Helpers
  // ============================================

  function renderCompanyInfo(app: VotingApplication | ArchivedApplication): React.ReactElement {
    return (
      <>
        {app.company_description && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
              Company Description
            </h3>
            <p className="text-gray-700">{app.company_description}</p>
          </div>
        )}

        {app.founder_bios && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
              Founder Bios
            </h3>
            <p className="text-gray-700 whitespace-pre-wrap">{app.founder_bios}</p>
          </div>
        )}

        {app.founder_linkedins && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
              Founder LinkedIn Profiles
            </h3>
            <div className="flex flex-wrap gap-2">
              {app.founder_linkedins
                .split(/[\n,]+/)
                .filter(Boolean)
                .map((link, i) => {
                  const url = link.trim()
                  const fullUrl = url.startsWith('http') ? url : `https://${url}`
                  return (
                    <a
                      key={i}
                      href={fullUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-[#0077B5] hover:text-[#005582] bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <LinkedInIcon />
                      LinkedIn {i + 1}
                    </a>
                  )
                })}
            </div>
          </div>
        )}

        {app.primary_email && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
              Primary Email
            </h3>
            <a
              href={`mailto:${app.primary_email}`}
              className="text-[#1a1a1a] hover:text-black underline"
            >
              {app.primary_email}
            </a>
          </div>
        )}

        {app.website && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
              Website
            </h3>
            <a
              href={app.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[#1a1a1a] hover:text-black underline"
            >
              <span>Website</span>
            </a>
          </div>
        )}

        {app.previous_funding && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
              Previous Funding
            </h3>
            <p className="text-gray-700 whitespace-pre-wrap">{app.previous_funding}</p>
          </div>
        )}

        {app.deck_link && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
              Pitch Deck / Additional Documents
            </h3>
            <a
              href={app.deck_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 font-medium"
            >
              View Deck
            </a>
          </div>
        )}

        <div>
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
            Submission Date
          </h3>
          <p className="text-gray-700">{formatDate(app.submitted_at)}</p>
        </div>
      </>
    )
  }

  function openVoteModal(app: VotingApplication): void {
    setSelectedVoteApp(app)
    setVote(app.userVote || '')
    setVoteNotes(app.userNotes || '')
  }

  function renderVoteCountIndicator(voteCount: number): React.ReactElement {
    return (
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`w-2.5 h-2.5 rounded-full ${
              i < voteCount ? 'bg-[#1a1a1a]' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
    )
  }

  function renderVoteSummary(votes: Vote[]): React.ReactElement {
    const yesVotes = votes.filter((v) => v.vote === 'yes').length
    const maybeVotes = votes.filter((v) => v.vote === 'maybe').length
    const noVotes = votes.filter((v) => v.vote === 'no').length

    return (
      <div className="flex gap-2 flex-shrink-0 ml-4">
        <div className="flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-lg">
          <span className="text-emerald-600 font-semibold">{yesVotes}</span>
          <span className="text-emerald-500 text-sm">Yes</span>
        </div>
        <div className="flex items-center gap-1.5 bg-amber-50 px-3 py-1.5 rounded-lg">
          <span className="text-amber-600 font-semibold">{maybeVotes}</span>
          <span className="text-amber-500 text-sm">Maybe</span>
        </div>
        <div className="flex items-center gap-1.5 bg-red-50 px-3 py-1.5 rounded-lg">
          <span className="text-red-600 font-semibold">{noVotes}</span>
          <span className="text-red-500 text-sm">No</span>
        </div>
      </div>
    )
  }

  function renderUserAvatar(name: string): React.ReactElement {
    return (
      <div className="w-8 h-8 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center flex-shrink-0">
        <span className="text-white text-sm font-medium">
          {name.charAt(0).toUpperCase()}
        </span>
      </div>
    )
  }

  function renderTabButton(
    tab: Tab,
    label: string,
    count: number
  ): React.ReactElement {
    return (
      <button
        onClick={() => setActiveTab(tab)}
        className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
          activeTab === tab
            ? 'border-[#1a1a1a] text-[#1a1a1a]'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
        }`}
      >
        {label}
        {count > 0 && (
          <span
            className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
              activeTab === tab ? 'bg-[#1a1a1a] text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {count}
          </span>
        )}
      </button>
    )
  }

  // ============================================
  // Render
  // ============================================

  return (
    <div className="mx-auto px-4 py-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Deals</h1>
        <CreateTicketButton currentUserId={userId} />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-3">
        <nav className="-mb-px flex gap-4">
          {renderTabButton('voting', 'Voting', votingCount)}
          {renderTabButton('deliberation', 'Deliberation', deliberationCount)}
          {renderTabButton('archive', 'Archive', archiveCount)}
        </nav>
      </div>

      {/* ============================================ */}
      {/* VOTING TAB */}
      {/* ============================================ */}
      {activeTab === 'voting' && (
        <div>
          {clientVotingApps.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-3 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-3xl">No applications</span>
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                No applications in voting
              </h3>
              <p className="text-gray-500">New applications will appear here when submitted.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Needs Your Vote Section */}
              {needsYourVote.length > 0 && (
                <section>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {needsYourVote.map((app) => (
                      <div
                        key={app.id}
                        className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden card-hover cursor-pointer"
                        onClick={() => setDetailVotingApp(app)}
                      >
                        <div className="p-3">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-semibold text-gray-900 truncate">
                                {app.company_name}
                              </h3>
                              {app.founder_names && (
                                <p className="text-xs text-gray-500 truncate">
                                  {app.founder_names}
                                </p>
                              )}
                            </div>
                            <div className="relative ml-2 flex-shrink-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setOpenMenuId(openMenuId === app.id ? null : app.id)
                                }}
                                className="p-1 hover:bg-gray-100 rounded transition-colors text-gray-400 hover:text-gray-600"
                              >
                                <DotsMenuIcon />
                              </button>
                              {openMenuId === app.id && (
                                <>
                                  <div
                                    className="fixed inset-0 z-10"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setOpenMenuId(null)
                                    }}
                                  />
                                  <div className="absolute right-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setOpenMenuId(null)
                                        setConfirmMoveApp(app)
                                      }}
                                      className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                                    >
                                      Move to Deliberation
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>

                          {app.company_description && (
                            <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                              {app.company_description}
                            </p>
                          )}

                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {app.website && (
                              <a
                                href={app.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Web
                              </a>
                            )}
                            {app.deck_link && (
                              <a
                                href={app.deck_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-2 py-1 rounded transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Deck
                              </a>
                            )}
                          </div>
                        </div>

                        <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                          <span className="text-xs text-gray-500">{app.voteCount}/3 votes</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openVoteModal(app)
                            }}
                            className="px-2.5 py-1 rounded text-xs font-medium bg-[#1a1a1a] text-white hover:bg-black transition-all"
                          >
                            Vote
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Already Voted Section */}
              {alreadyVoted.length > 0 && (
                <section>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {alreadyVoted.map((app) => {
                      const allVotesIn = app.voteCount >= 3
                      return (
                        <div
                          key={app.id}
                          className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden card-hover cursor-pointer"
                          onClick={() => setDetailVotingApp(app)}
                        >
                          <div className="p-3">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-semibold text-gray-900 truncate">
                                  {app.company_name}
                                </h3>
                                {app.founder_names && (
                                  <p className="text-sm text-gray-500 mt-0.5 truncate">
                                    {app.founder_names}
                                  </p>
                                )}
                              </div>
                              {app.userVote && (
                                <span className={`badge ${getVoteBadgeStyle(app.userVote)}`}>
                                  Your vote: {app.userVote}
                                </span>
                              )}
                            </div>

                            {app.company_description && (
                              <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                                {app.company_description}
                              </p>
                            )}

                            <div className="flex flex-wrap gap-2 mb-2">
                              {app.website && (
                                <a
                                  href={app.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-sm text-[#1a1a1a] hover:text-black bg-[#f5f5f5] hover:bg-[#e5e5e5] px-3 py-1.5 rounded-lg transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Website
                                </a>
                              )}
                              {app.deck_link && (
                                <a
                                  href={app.deck_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Deck
                                </a>
                              )}
                            </div>

                            {/* Vote Status */}
                            {!allVotesIn && app.voteCount > 0 && (
                              <div className="bg-gray-50 rounded-lg p-2 mb-2">
                                <p className="text-sm text-gray-600 mb-2">
                                  <span className="font-medium">{app.voteCount}/3</span> partners
                                  have voted
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {app.allVotes.map((v, i) => (
                                    <span
                                      key={i}
                                      className="inline-flex items-center gap-1.5 text-sm bg-white px-2.5 py-1 rounded-lg border border-gray-200"
                                    >
                                      <span className="w-2 h-2 bg-[#1a1a1a] rounded-full"></span>
                                      {v.userName}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Revealed Votes */}
                            {allVotesIn && (
                              <div className="bg-emerald-50 rounded-lg p-2 mb-2 border border-emerald-100">
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="text-emerald-600">Complete</span>
                                  <p className="text-sm font-medium text-emerald-800">
                                    All 3 partners have voted!
                                  </p>
                                </div>
                                <div className="grid gap-3">
                                  {app.allVotes.map((v, i) => (
                                    <div key={i} className="bg-white rounded-lg p-2">
                                      <div className="flex items-center gap-3">
                                        {renderUserAvatar(v.userName)}
                                        <div className="flex-1 min-w-0">
                                          <p className="font-medium text-gray-900 truncate">
                                            {v.userName}
                                          </p>
                                        </div>
                                        <span className={`badge ${getVoteBadgeStyle(v.vote)}`}>
                                          {v.vote}
                                        </span>
                                      </div>
                                      {v.notes && (
                                        <p className="text-sm text-gray-600 mt-2 ml-11">
                                          {v.notes}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="px-3 py-2 bg-gray-50 border-t border-gray-100">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                {renderVoteCountIndicator(app.voteCount)}
                                <span className="text-sm text-gray-500">
                                  {app.voteCount}/3 votes
                                </span>
                              </div>

                              <div className="flex gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    openVoteModal(app)
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all"
                                >
                                  Edit Vote
                                </button>
                                {allVotesIn && (
                                  <span className="px-3 py-2 rounded-lg text-sm font-medium bg-emerald-100 text-emerald-700">
                                    Ready to advance
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============================================ */}
      {/* DELIBERATION TAB */}
      {/* ============================================ */}
      {activeTab === 'deliberation' && (
        <div>
          {undecidedDeliberations.length === 0 && decidedDeliberations.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-3 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-3xl">No deliberations</span>
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                No applications in deliberation
              </h3>
              <p className="text-gray-500">
                Applications will appear here once votes are revealed.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Needs Decision Section */}
              {undecidedDeliberations.length > 0 && (
                <section>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {undecidedDeliberations.map((app) => (
                      <div
                        key={app.id}
                        className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden card-hover cursor-pointer"
                        onClick={() => setDetailDelibApp(app)}
                      >
                        <div className="p-3">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-semibold text-gray-900 truncate">
                                {app.company_name}
                              </h3>
                              {app.founder_names && (
                                <p className="text-xs text-gray-500 truncate">{app.founder_names}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                              {app.deliberation?.status &&
                                app.deliberation.status !== 'scheduled' && (
                                  <span className={`badge text-xs ${getStatusBadgeStyle(app.deliberation.status)}`}>
                                    {app.deliberation.status}
                                  </span>
                                )}
                              {app.email_sent && (
                                <span className="badge text-xs bg-blue-100 text-blue-700">Sent</span>
                              )}
                            </div>
                          </div>

                          {app.company_description && (
                            <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                              {app.company_description}
                            </p>
                          )}

                          {/* Compact vote summary */}
                          {app.votes && app.votes.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {app.votes.map((voteItem) => (
                                <span
                                  key={voteItem.oduserId}
                                  className={`text-xs px-1.5 py-0.5 rounded ${getVoteBadgeStyle(voteItem.vote)}`}
                                  title={voteItem.userName}
                                >
                                  {voteItem.userName.split(' ')[0]}: {voteItem.vote}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {app.website && (
                              <a
                                href={app.website.startsWith('http') ? app.website : `https://${app.website}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Web
                              </a>
                            )}
                            {app.deck_link && (
                              <a
                                href={app.deck_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-2 py-1 rounded transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Deck
                              </a>
                            )}
                          </div>
                        </div>

                        <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 flex gap-2">
                          <Link
                            href={`/deliberation/${app.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs px-2 py-1 rounded bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                          >
                            Notes
                          </Link>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openDeliberationModal(app)
                            }}
                            className="text-xs px-2 py-1 rounded bg-[#1a1a1a] text-white hover:bg-black"
                          >
                            Decide
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Already Decided Section */}
              {decidedDeliberations.length > 0 && (
                <section>
                  {/* Search and Sort Controls */}
                  <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-3 mb-2">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="flex-1 relative">
                        <SearchIcon />
                        <input
                          type="text"
                          placeholder="Search by company, founder, or description..."
                          value={delibSearchQuery}
                          onChange={(e) => setDelibSearchQuery(e.target.value)}
                          className="input !pl-11"
                        />
                      </div>
                      <div className="sm:w-48">
                        <select
                          value={delibSortOption}
                          onChange={(e) => setDelibSortOption(e.target.value as SortOption)}
                          className="input"
                        >
                          <option value="date-newest">Newest First</option>
                          <option value="date-oldest">Oldest First</option>
                          <option value="name-az">Name (A-Z)</option>
                          <option value="name-za">Name (Z-A)</option>
                          <option value="decision-yes">Yes Decisions First</option>
                          <option value="decision-no">No Decisions First</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {filteredDecidedDeliberations.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 text-center">
                      <p className="text-gray-500">No applications match your search.</p>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {filteredDecidedDeliberations.map((app) => (
                        <div
                          key={app.id}
                          className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden card-hover cursor-pointer"
                          onClick={() => setDetailDelibApp(app)}
                        >
                          <div className="p-3">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-semibold text-gray-900 truncate">{app.company_name}</h3>
                                {app.founder_names && (
                                  <p className="text-xs text-gray-500 truncate">{app.founder_names}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-1 ml-2">
                                {app.deliberation?.decision && (
                                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${getDecisionBadgeStyle(app.deliberation.decision)}`}>
                                    {app.deliberation.decision.toUpperCase()}
                                  </span>
                                )}
                              </div>
                            </div>
                            {app.company_description && (
                              <p className="text-xs text-gray-600 line-clamp-2 mb-2">{app.company_description}</p>
                            )}
                            {/* Compact vote summary */}
                            {app.votes && app.votes.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-2">
                                {app.votes.map((voteItem, idx) => (
                                  <span
                                    key={`${app.id}-vote-${idx}`}
                                    className={`text-xs px-1.5 py-0.5 rounded ${getVoteBadgeStyle(voteItem.vote)}`}
                                  >
                                    {voteItem.userName.split(' ')[0]}: {voteItem.vote}
                                  </span>
                                ))}
                              </div>
                            )}
                            <p className="text-xs text-gray-400">{formatDate(app.submitted_at)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============================================ */}
      {/* ARCHIVE TAB */}
      {/* ============================================ */}
      {activeTab === 'archive' && (
        <div>
          {archivedApplications.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-3 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-3xl">No archive</span>
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                No archived applications
              </h3>
              <p className="text-gray-500">
                Applications that have been invested or rejected will appear here.
              </p>
            </div>
          ) : (
            <div>
              {/* Search and Sort Controls */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-3 mb-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1 relative">
                    <SearchIcon />
                    <input
                      type="text"
                      placeholder="Search by company, founder, or description..."
                      value={archiveSearchQuery}
                      onChange={(e) => setArchiveSearchQuery(e.target.value)}
                      className="input !pl-11"
                    />
                  </div>
                  <div className="sm:w-48">
                    <select
                      value={archiveSortOption}
                      onChange={(e) => setArchiveSortOption(e.target.value as SortOption)}
                      className="input"
                    >
                      <option value="date-newest">Newest First</option>
                      <option value="date-oldest">Oldest First</option>
                      <option value="name-az">Name (A-Z)</option>
                      <option value="name-za">Name (Z-A)</option>
                      <option value="stage">By Status</option>
                    </select>
                  </div>
                </div>
              </div>

              {filteredArchivedApplications.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 text-center">
                  <p className="text-gray-500">No applications match your search.</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredArchivedApplications.map((app) => (
                    <div
                      key={app.id}
                      className="bg-white rounded-lg shadow-sm border border-gray-100 p-3 cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => setDetailArchivedApp(app)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 truncate">
                            {app.company_name}
                          </h3>
                          {app.founder_names && (
                            <p className="text-sm text-gray-500 truncate">{app.founder_names}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                          {app.email_sent ? (
                            <span className="badge text-xs bg-blue-100 text-blue-700">
                              Email Sent
                            </span>
                          ) : (
                            app.email_sender_name && (
                              <span className="badge text-xs bg-purple-100 text-purple-700">
                                {app.email_sender_name} sending
                              </span>
                            )
                          )}
                          <span
                            className={`badge capitalize ${getStageBadgeStyle(app.stage)}`}
                          >
                            {app.stage || 'N/A'}
                          </span>
                        </div>
                      </div>
                      {app.company_description && (
                        <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                          {app.company_description}
                        </p>
                      )}
                      <p className="text-xs text-gray-400">
                        Submitted {formatDate(app.submitted_at)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============================================ */}
      {/* MODALS */}
      {/* ============================================ */}

      {/* Vote Modal */}
      {selectedVoteApp && (
        <div
          className="modal-backdrop"
          onClick={() => !voteLoading && setSelectedVoteApp(null)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="px-3 py-2 border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {selectedVoteApp.company_name}
                  </h2>
                  {selectedVoteApp.founder_names && (
                    <p className="text-gray-500 mt-1">{selectedVoteApp.founder_names}</p>
                  )}
                </div>
                <button
                  onClick={() => !voteLoading && setSelectedVoteApp(null)}
                  className="text-gray-400 hover:text-gray-600 p-2 -m-2"
                >
                  <CloseIcon />
                </button>
              </div>
            </div>

            <div className="p-3 space-y-2 max-h-[70vh] overflow-y-auto">
              {renderCompanyInfo(selectedVoteApp)}

              <div>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
                  Your Vote
                </h3>
                <div className="flex gap-3">
                  {['yes', 'maybe', 'no'].map((option) => (
                    <button
                      key={option}
                      onClick={() => setVote(option)}
                      className={getVoteButtonStyle(option)}
                    >
                      <div className="text-2xl mb-1">
                        {option === 'yes' ? 'Yes' : option === 'maybe' ? 'Maybe' : 'No'}
                      </div>
                      <div className="capitalize">{option}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Notes (optional)
                </label>
                <textarea
                  value={voteNotes}
                  onChange={(e) => setVoteNotes(e.target.value)}
                  rows={3}
                  className="input resize-none"
                  placeholder="Share your thoughts on this application..."
                />
              </div>
            </div>

            <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => {
                  setSelectedVoteApp(null)
                  setVote('')
                  setVoteNotes('')
                }}
                className="btn btn-secondary flex-1"
                disabled={voteLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleVoteSubmit}
                disabled={!vote || voteLoading}
                className="btn btn-primary flex-1"
              >
                {voteLoading ? (
                  <span className="flex items-center gap-2">
                    <SpinnerIcon />
                    Submitting...
                  </span>
                ) : (
                  'Submit Vote'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Voting App Detail Modal */}
      {detailVotingApp && (
        <div className="modal-backdrop" onClick={() => setDetailVotingApp(null)}>
          <div className="modal-content max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-3 py-2 border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {detailVotingApp.company_name}
                  </h2>
                  {detailVotingApp.founder_names && (
                    <p className="text-gray-500 mt-1">{detailVotingApp.founder_names}</p>
                  )}
                </div>
                <button
                  onClick={() => setDetailVotingApp(null)}
                  className="text-gray-400 hover:text-gray-600 p-2 -m-2"
                >
                  <CloseIcon />
                </button>
              </div>
            </div>

            <div className="p-3 space-y-2 max-h-[70vh] overflow-y-auto">
              {renderCompanyInfo(detailVotingApp)}

              {detailVotingApp.allVotes.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
                    Votes ({detailVotingApp.voteCount}/3)
                  </h3>
                  <div className="grid gap-2">
                    {detailVotingApp.allVotes.map((v, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg"
                      >
                        <span className="text-sm font-medium text-gray-700">{v.userName}</span>
                        {detailVotingApp.voteCount >= 3 ? (
                          <span className={`badge ${getVoteBadgeStyle(v.vote)}`}>{v.vote}</span>
                        ) : (
                          <span className="badge bg-gray-100 text-gray-600">Voted</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-3 py-2 bg-gray-50 border-t border-gray-100">
              <div className="flex flex-wrap justify-between gap-3">
                <div className="flex gap-3">
                  {detailVotingApp.voteCount >= 3 && (
                    <>
                      <button
                        onClick={() => {
                          setDetailVotingApp(null)
                          promptReject(detailVotingApp)
                        }}
                        disabled={movingToDelib === detailVotingApp.id}
                        className="btn bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => {
                          setDetailVotingApp(null)
                          promptMoveToDeliberation(detailVotingApp)
                        }}
                        disabled={movingToDelib === detailVotingApp.id}
                        className="btn bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                      >
                        Move to Deliberation
                      </button>
                    </>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setDetailVotingApp(null)
                      openVoteModal(detailVotingApp)
                    }}
                    className={`btn ${detailVotingApp.userVote ? 'btn-secondary' : 'btn-primary'}`}
                  >
                    {detailVotingApp.userVote ? 'Edit Vote' : 'Cast Vote'}
                  </button>
                  <button onClick={() => setDetailVotingApp(null)} className="btn btn-secondary">
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Moving to Deliberation Without Voting */}
      {confirmMoveApp && (
        <div
          className="modal-backdrop"
          onClick={() => !movingToDelib && setConfirmMoveApp(null)}
        >
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="px-3 py-2 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Confirm Move to Deliberation</h2>
            </div>

            <div className="p-3">
              <p className="text-gray-700">
                Are you sure you want to move{' '}
                <span className="font-semibold">{confirmMoveApp.company_name}</span> to
                deliberation without completing all votes?
              </p>
            </div>

            <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setConfirmMoveApp(null)}
                className="btn btn-secondary flex-1"
                disabled={movingToDelib === confirmMoveApp.id}
              >
                Cancel
              </button>
              <button
                onClick={handleMoveToDeliberationWithoutVoting}
                disabled={movingToDelib === confirmMoveApp.id}
                className="btn btn-primary flex-1"
              >
                {movingToDelib === confirmMoveApp.id ? (
                  <span className="flex items-center justify-center gap-2">
                    <SpinnerIcon />
                    Moving...
                  </span>
                ) : (
                  'Confirm'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Sender Modal */}
      {emailSenderModal && (
        <div
          className="modal-backdrop"
          onClick={() => !movingToDelib && setEmailSenderModal(null)}
        >
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="px-3 py-2 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">
                {emailSenderModal.action === 'deliberation'
                  ? 'Move to Deliberation'
                  : 'Reject Application'}
              </h2>
              <p className="text-gray-500 mt-1">{emailSenderModal.app.company_name}</p>
            </div>

            <div className="p-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Who is sending the email?
              </label>
              <select
                value={selectedEmailSender}
                onChange={(e) => setSelectedEmailSender(e.target.value)}
                className="input"
              >
                <option value="">Select a partner...</option>
                {partners.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setEmailSenderModal(null)}
                className="btn btn-secondary flex-1"
                disabled={movingToDelib === emailSenderModal.app.id}
              >
                Cancel
              </button>
              <button
                onClick={handleEmailSenderConfirm}
                disabled={!selectedEmailSender || movingToDelib === emailSenderModal.app.id}
                className={`btn flex-1 ${emailSenderModal.action === 'reject' ? 'bg-red-600 hover:bg-red-700 text-white' : 'btn-primary'}`}
              >
                {movingToDelib === emailSenderModal.app.id ? (
                  <span className="flex items-center justify-center gap-2">
                    <SpinnerIcon />
                    Processing...
                  </span>
                ) : emailSenderModal.action === 'deliberation' ? (
                  'Move to Deliberation'
                ) : (
                  'Reject Application'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deliberation Modal */}
      {selectedDelibApp && (
        <div
          className="modal-backdrop"
          onClick={() => !delibLoading && setSelectedDelibApp(null)}
        >
          <div className="modal-content max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-3 py-2 border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {selectedDelibApp.company_name}
                  </h2>
                  <p className="text-gray-500 mt-1">Add deliberation notes and final decision</p>
                </div>
                <button
                  onClick={() => !delibLoading && setSelectedDelibApp(null)}
                  className="text-gray-400 hover:text-gray-600 p-2 -m-2"
                >
                  <CloseIcon />
                </button>
              </div>
            </div>

            <div className="p-3 space-y-2 max-h-[70vh] overflow-y-auto">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Meeting Date
                  </label>
                  <input
                    type="date"
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="input"
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="met">Met</option>
                    <option value="emailed">Emailed</option>
                    <option value="invested">Invested</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Idea Summary
                </label>
                <textarea
                  value={ideaSummary}
                  onChange={(e) => setIdeaSummary(e.target.value)}
                  rows={3}
                  className="input resize-none"
                  placeholder="Brief summary of the company's idea..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Thoughts & Notes
                </label>
                <textarea
                  value={thoughts}
                  onChange={(e) => setThoughts(e.target.value)}
                  rows={4}
                  className="input resize-none"
                  placeholder="Discussion notes, concerns, opportunities..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Final Decision
                </label>
                <div className="flex gap-3">
                  {[
                    { value: 'pending', label: 'Pending', color: 'gray' },
                    { value: 'yes', label: 'Yes', color: 'emerald' },
                    { value: 'no', label: 'No', color: 'red' },
                  ].map((option) => {
                    let selectedStyle = ''
                    if (decision === option.value) {
                      if (option.color === 'emerald') {
                        selectedStyle = 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      } else if (option.color === 'red') {
                        selectedStyle = 'border-red-500 bg-red-50 text-red-700'
                      } else {
                        selectedStyle = 'border-gray-400 bg-gray-50 text-gray-700'
                      }
                    } else {
                      selectedStyle =
                        'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }

                    return (
                      <button
                        key={option.value}
                        onClick={() => setDecision(option.value)}
                        className={`flex-1 py-3 px-4 rounded-xl border-2 font-semibold text-center transition-all ${selectedStyle}`}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Investment Details */}
              {decision === 'yes' && (
                <div className="bg-emerald-50 rounded-xl p-3 border-2 border-emerald-200">
                  <h3 className="text-sm font-semibold text-emerald-800 mb-2 flex items-center gap-2">
                    <span>Investment Details</span>
                  </h3>
                  <p className="text-sm text-emerald-700 mb-2">
                    Please enter the investment details. This will create a portfolio entry.
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-emerald-800 mb-1.5">
                        Investment Amount *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                          $
                        </span>
                        <input
                          type="number"
                          value={investmentAmount || ''}
                          onChange={(e) =>
                            setInvestmentAmount(e.target.value ? parseFloat(e.target.value) : null)
                          }
                          className="input pl-7"
                          placeholder="100000"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-emerald-800 mb-1.5">
                        Investment Date *
                      </label>
                      <input
                        type="date"
                        value={investmentDate}
                        onChange={(e) => setInvestmentDate(e.target.value)}
                        className="input"
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-emerald-800 mb-1.5">
                      Terms *
                    </label>
                    <input
                      type="text"
                      value={investmentTerms}
                      onChange={(e) => setInvestmentTerms(e.target.value)}
                      onFocus={(e) => {
                        if (e.target.value === '10mm cap safe') {
                          setInvestmentTerms('')
                        }
                      }}
                      className="input"
                    />
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-emerald-800 mb-1.5">
                      Co-Investors (optional)
                    </label>
                    <input
                      type="text"
                      value={otherFunders}
                      onChange={(e) => setOtherFunders(e.target.value)}
                      className="input"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setSelectedDelibApp(null)}
                className="btn btn-secondary flex-1"
                disabled={delibLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDeliberation}
                disabled={delibLoading}
                className="btn btn-primary flex-1"
              >
                {delibLoading ? (
                  <span className="flex items-center gap-2">
                    <SpinnerIcon />
                    Saving...
                  </span>
                ) : (
                  'Save Deliberation'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deliberation App Detail Modal */}
      {detailDelibApp && (
        <ApplicationDetailModal
          application={detailDelibApp}
          onClose={() => setDetailDelibApp(null)}
          actions={
            <button
              onClick={() => {
                setDetailDelibApp(null)
                openDeliberationModal(detailDelibApp)
              }}
              className="btn btn-primary"
            >
              {detailDelibApp.deliberation ? 'Edit Deliberation' : 'Add Deliberation'}
            </button>
          }
        />
      )}

      {/* Archived App Detail Modal */}
      {detailArchivedApp && (
        <div className="modal-backdrop" onClick={() => setDetailArchivedApp(null)}>
          <div className="modal-content max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-3 py-2 border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-gray-900">
                      {detailArchivedApp.company_name}
                    </h2>
                    <span
                      className={`badge capitalize ${getStageBadgeStyle(detailArchivedApp.stage)}`}
                    >
                      {detailArchivedApp.stage || 'N/A'}
                    </span>
                  </div>
                  {detailArchivedApp.founder_names && (
                    <p className="text-gray-500 mt-1">{detailArchivedApp.founder_names}</p>
                  )}
                </div>
                <button
                  onClick={() => setDetailArchivedApp(null)}
                  className="text-gray-400 hover:text-gray-600 p-2 -m-2"
                >
                  <CloseIcon />
                </button>
              </div>
            </div>

            <div className="p-3 space-y-2 max-h-[70vh] overflow-y-auto">
              {renderCompanyInfo(detailArchivedApp)}

              {detailArchivedApp.allVotes && detailArchivedApp.allVotes.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
                    Partner Votes
                  </h3>
                  <div className="grid gap-3">
                    {detailArchivedApp.allVotes.map((v, i) => (
                      <div key={i} className="bg-gray-50 rounded-lg p-2">
                        <div className="flex items-center gap-3">
                          {renderUserAvatar(v.userName)}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">{v.userName}</p>
                          </div>
                          <span className={`badge ${getVoteBadgeStyle(v.vote)}`}>{v.vote}</span>
                        </div>
                        {v.notes && (
                          <p className="text-sm text-gray-600 mt-2 ml-11">{v.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Draft Rejection Email */}
              {detailArchivedApp.stage === 'rejected' && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                      Draft Rejection Email
                    </h3>
                    {!detailArchivedApp.draft_rejection_email && (
                      <button
                        onClick={() => generateRejectionEmail(detailArchivedApp.id)}
                        disabled={generatingEmail === detailArchivedApp.id}
                        className="text-sm text-purple-600 hover:text-purple-700 font-medium disabled:opacity-50"
                      >
                        {generatingEmail === detailArchivedApp.id
                          ? 'Generating...'
                          : 'Generate Email'}
                      </button>
                    )}
                  </div>

                  {generatingEmail === detailArchivedApp.id ? (
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <SpinnerIcon className="h-8 w-8 mx-auto text-purple-600 mb-3" />
                      <p className="text-gray-600">Generating rejection email with AI...</p>
                    </div>
                  ) : detailArchivedApp.draft_rejection_email ? (
                    <div className="space-y-3">
                      <textarea
                        value={editingEmail || detailArchivedApp.draft_rejection_email}
                        onChange={(e) => setEditingEmail(e.target.value)}
                        onFocus={() =>
                          !editingEmail &&
                          setEditingEmail(detailArchivedApp.draft_rejection_email || '')
                        }
                        rows={12}
                        className="input font-mono text-sm resize-y min-h-[200px]"
                        placeholder="Draft rejection email..."
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            copyToClipboard(
                              editingEmail || detailArchivedApp.draft_rejection_email || ''
                            )
                          }
                          className="btn btn-secondary flex items-center gap-2"
                        >
                          <CopyIcon />
                          Copy to Clipboard
                        </button>
                        {editingEmail &&
                          editingEmail !== detailArchivedApp.draft_rejection_email && (
                            <>
                              <button
                                onClick={() =>
                                  saveEditedEmail(detailArchivedApp.id, editingEmail)
                                }
                                disabled={savingEmail}
                                className="btn btn-primary flex items-center gap-2"
                              >
                                {savingEmail ? (
                                  <>
                                    <SpinnerIcon />
                                    Saving...
                                  </>
                                ) : (
                                  'Save Changes'
                                )}
                              </button>
                              <button
                                onClick={() => setEditingEmail('')}
                                className="btn btn-secondary"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-gray-500 mb-3">No rejection email draft yet.</p>
                      <button
                        onClick={() => generateRejectionEmail(detailArchivedApp.id)}
                        disabled={generatingEmail === detailArchivedApp.id}
                        className="btn btn-primary"
                      >
                        Generate Rejection Email
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button onClick={() => setDetailArchivedApp(null)} className="btn btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
