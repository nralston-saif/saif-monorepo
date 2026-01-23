'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/types/database'
import CreateTicketButton from '@/components/CreateTicketButton'
import PersonModal from '@/components/PersonModal'
import AddPersonToCompanyModal from '@/components/AddPersonToCompanyModal'
import TagSelector from '@/app/tickets/TagSelector'
import FocusTagSelector from '@/components/FocusTagSelector'
import CompanyNotes from '@/components/CompanyNotes'
import { ensureProtocol } from '@/lib/utils'
import { useToast } from '@saif/ui'
import type { ActiveDeal } from './page'

type Company = Database['public']['Tables']['saif_companies']['Row']
type Person = Database['public']['Tables']['saif_people']['Row']
type CompanyPerson = Database['public']['Tables']['saif_company_people']['Row']

type Partner = {
  id: string
  name: string
}

// Database stores lowercase values for type
const INVESTMENT_TYPES = [
  { value: 'note', label: 'Note' },
  { value: 'safe', label: 'SAFE' },
  { value: 'equity', label: 'Equity' },
  { value: 'option', label: 'Option' },
  { value: 'other', label: 'Other' },
] as const

const INVESTMENT_ROUNDS = [
  { value: 'Pre-Seed', label: 'Pre-Seed' },
  { value: 'Seed', label: 'Seed' },
  { value: 'Series A', label: 'Series A' },
  { value: 'Series B', label: 'Series B' },
  { value: 'Series C', label: 'Series C' },
  { value: 'Series D', label: 'Series D' },
  { value: 'Series E', label: 'Series E' },
  { value: 'Series F', label: 'Series F' },
  { value: 'Series G', label: 'Series G' },
] as const

const COMPANY_STAGES = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'diligence', label: 'Diligence' },
  { value: 'portfolio', label: 'Portfolio' },
  { value: 'passed', label: 'Passed' },
  { value: 'tracked', label: 'Tracked' },
  { value: 'archived', label: 'Archived' },
  { value: 'saif', label: 'SAIF' },
] as const

interface CompanyViewProps {
  company: Company & {
    people?: (CompanyPerson & {
      person: Person | null
    })[]
    investments?: any[]
  }
  canEdit: boolean
  isPartner: boolean
  currentPersonId: string
  userName: string
  activeDeal?: ActiveDeal | null
  partners?: Partner[]
}

export default function CompanyView({ company, canEdit, isPartner, currentPersonId, userName, activeDeal, partners = [] }: CompanyViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const { showToast } = useToast()

  // Start in edit mode if ?edit=true is in URL
  const [isEditing, setIsEditing] = useState(searchParams.get('edit') === 'true' && canEdit)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Person modal state
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)

  // Add person to company modal state
  const [showAddPersonModal, setShowAddPersonModal] = useState(false)

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Active deal decision state
  const [showDecisionModal, setShowDecisionModal] = useState(false)
  const [decisionLoading, setDecisionLoading] = useState(false)
  const [ideaSummary, setIdeaSummary] = useState(activeDeal?.deliberation?.idea_summary || '')
  const [thoughts, setThoughts] = useState(activeDeal?.deliberation?.thoughts || '')
  const [decision, setDecision] = useState(activeDeal?.deliberation?.decision || 'pending')
  const [meetingDate, setMeetingDate] = useState(activeDeal?.deliberation?.meeting_date || '')
  const [status, setStatus] = useState(activeDeal?.deliberation?.status || 'scheduled')
  // Investment fields (for yes decision)
  const [investmentAmount, setInvestmentAmount] = useState<number | null>(null)
  const [investmentTerms, setInvestmentTerms] = useState('10mm cap safe')
  const [investmentDate, setInvestmentDate] = useState(new Date().toISOString().split('T')[0])
  const [otherFunders, setOtherFunders] = useState('')
  // Rejection field
  const [rejectionEmailSender, setRejectionEmailSender] = useState('')

  // Founder management state
  const [showAddFounder, setShowAddFounder] = useState(false)
  const [addingFounder, setAddingFounder] = useState(false)
  const [newFounder, setNewFounder] = useState({
    first_name: '',
    last_name: '',
    email: '',
    title: '',
  })

  const [formData, setFormData] = useState({
    name: company.name,
    previous_names: company.previous_names?.join(', ') || '',
    short_description: company.short_description || '',
    website: company.website || '',
    industry: company.industry || '',
    founded_year: company.founded_year?.toString() || '',
    city: company.city || '',
    country: company.country || '',
    yc_batch: company.yc_batch || '',
    is_aisafety_company: company.is_aisafety_company,
    tags: company.tags || [],
    stage: company.stage || '',
  })

  const [logoUrl, setLogoUrl] = useState(company.logo_url)

  // Investment editing state
  const [investmentData, setInvestmentData] = useState(() => {
    const inv = company.investments?.[0]
    return {
      id: inv?.id || null,
      type: inv?.type?.toLowerCase() || '', // Normalize to lowercase
      round: inv?.round || '',
      amount: inv?.amount?.toString() || '',
      post_money_valuation: inv?.post_money_valuation ? (inv.post_money_valuation / 1000000).toString() : '',
      investment_date: inv?.investment_date?.split('T')[0] || '', // Format date for input
    }
  })

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked
      setFormData((prev) => ({ ...prev, [name]: checked }))
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }))
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingLogo(true)
    setError(null)

    try {
      // Check file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        setError('File size must be less than 2MB')
        setUploadingLogo(false)
        return
      }

      // Check file type
      if (!file.type.startsWith('image/')) {
        setError('File must be an image')
        setUploadingLogo(false)
        return
      }

      // Delete old logo if exists
      if (logoUrl) {
        const oldPath = logoUrl.includes('/storage/v1/object/public/')
          ? logoUrl.split('/storage/v1/object/public/saif-company-logos/')[1]
          : logoUrl

        if (oldPath) {
          await supabase.storage
            .from('saif-company-logos')
            .remove([oldPath])
        }
      }

      // Upload new logo
      const fileExt = file.name.split('.').pop()
      const fileName = `logo-${Date.now()}.${fileExt}`
      const filePath = `${company.id}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('saif-company-logos')
        .upload(filePath, file)

      if (uploadError) {
        throw uploadError
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('saif-company-logos')
        .getPublicUrl(filePath)

      // Update company with new logo URL
      const { error: updateError } = await supabase
        .from('saif_companies')
        .update({ logo_url: publicUrl })
        .eq('id', company.id)

      if (updateError) {
        throw updateError
      }

      setLogoUrl(`${publicUrl}?t=${Date.now()}`)
      setSuccess('Logo uploaded successfully!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      console.error('Error uploading logo:', err)
      const errorMessage = err?.message || err?.error?.message || 'Unknown error'
      setError(`Failed to upload logo: ${errorMessage}`)
    } finally {
      setUploadingLogo(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      // Parse previous_names from comma-separated string to array
      const previousNamesArray = formData.previous_names
        ? formData.previous_names.split(',').map(name => name.trim()).filter(Boolean)
        : null

      const { data: updateData, error: updateError } = await supabase
        .from('saif_companies')
        .update({
          name: formData.name,
          previous_names: previousNamesArray,
          short_description: formData.short_description || null,
          website: formData.website || null,
          industry: formData.industry || null,
          founded_year: formData.founded_year ? parseInt(formData.founded_year) : null,
          city: formData.city || null,
          country: formData.country || null,
          yc_batch: formData.yc_batch || null,
          is_aisafety_company: formData.is_aisafety_company,
          tags: formData.tags,
          stage: formData.stage || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', company.id)
        .select()

      if (updateError) {
        throw updateError
      }

      // Check if update actually affected any rows (RLS might silently block)
      if (!updateData || updateData.length === 0) {
        throw new Error('Update failed - you may not have permission to edit this company')
      }

      // Save investment data if partner and there's investment data to save
      if (isPartner && (investmentData.type || investmentData.round || investmentData.amount || investmentData.post_money_valuation)) {
        const invDataToSave = {
          company_id: company.id,
          type: investmentData.type || null,
          round: investmentData.round || null,
          amount: investmentData.amount ? parseFloat(investmentData.amount) : null,
          post_money_valuation: investmentData.post_money_valuation ? parseFloat(investmentData.post_money_valuation) * 1000000 : null,
          investment_date: investmentData.investment_date || null,
        }

        if (investmentData.id) {
          // Update existing investment
          const { error: invError } = await supabase
            .from('saif_investments')
            .update(invDataToSave)
            .eq('id', investmentData.id)

          if (invError) {
            console.error('Error updating investment:', invError)
            // Don't throw - company was saved successfully
          }
        } else {
          // Create new investment
          const { data: newInv, error: invError } = await supabase
            .from('saif_investments')
            .insert({ ...invDataToSave, status: 'active' })
            .select()
            .single()

          if (invError) {
            console.error('Error creating investment:', invError)
            // Don't throw - company was saved successfully
          } else if (newInv) {
            setInvestmentData(prev => ({ ...prev, id: newInv.id }))
          }
        }
      }

      setSuccess('Company updated successfully!')
      setIsEditing(false)

      // Refresh the page to show updated data
      setTimeout(() => {
        router.refresh()
      }, 1000)
    } catch (err: any) {
      console.error('Error updating company:', err)
      // Try multiple ways to extract error info from Supabase errors
      let errorMessage = 'Unknown error'
      if (typeof err === 'string') {
        errorMessage = err
      } else if (err?.message) {
        errorMessage = err.message
      } else if (err?.error?.message) {
        errorMessage = err.error.message
      } else if (err?.error_description) {
        errorMessage = err.error_description
      } else if (err?.msg) {
        errorMessage = err.msg
      } else if (Object.keys(err || {}).length > 0) {
        // Fallback: stringify the whole error object
        errorMessage = JSON.stringify(err)
      }
      const errorCode = err?.code || err?.error?.code || err?.statusCode || ''
      const errorDetails = err?.details || err?.error?.details || err?.hint || ''
      setError(`Failed to update company: ${errorMessage}${errorCode ? ` (${errorCode})` : ''}${errorDetails ? ` - ${errorDetails}` : ''}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)

    try {
      // Delete company-people associations first
      await supabase
        .from('saif_company_people')
        .delete()
        .eq('company_id', company.id)

      // Delete investments
      await supabase
        .from('saif_investments')
        .delete()
        .eq('company_id', company.id)

      // Delete the company
      const { error: deleteError } = await supabase
        .from('saif_companies')
        .delete()
        .eq('id', company.id)

      if (deleteError) throw deleteError

      // Redirect to companies list
      router.push('/companies')
    } catch (err: any) {
      console.error('Error deleting company:', err)
      setError(`Failed to delete: ${err?.message || 'Unknown error'}`)
      setShowDeleteConfirm(false)
    } finally {
      setDeleting(false)
    }
  }

  const handleSaveDecision = async () => {
    if (!activeDeal) return

    // Validate investment fields if decision is 'yes'
    if (decision === 'yes') {
      if (!investmentAmount || investmentAmount <= 0) {
        showToast('Please enter an investment amount', 'warning')
        return
      }
      if (!investmentTerms) {
        showToast('Please enter investment terms', 'warning')
        return
      }
    }

    // Validate email sender if decision is 'no'
    if (decision === 'no' && !rejectionEmailSender) {
      showToast('Please select who will send the rejection email', 'warning')
      return
    }

    setDecisionLoading(true)
    try {
      // Upsert deliberation
      const { error: deliberationError } = await supabase.from('saifcrm_deliberations').upsert(
        {
          application_id: activeDeal.id,
          idea_summary: ideaSummary || null,
          thoughts: thoughts || null,
          decision: decision as 'pending' | 'maybe' | 'yes' | 'no',
          status: decision === 'yes' ? 'portfolio' : status,
          meeting_date: meetingDate || null,
        },
        { onConflict: 'application_id' }
      )

      if (deliberationError) {
        showToast('Error saving deliberation: ' + deliberationError.message, 'error')
        setDecisionLoading(false)
        return
      }

      // Handle 'yes' decision - create investment
      if (decision === 'yes') {
        const { error: investmentError } = await supabase
          .from('saifcrm_investments')
          .insert({
            company_name: activeDeal.company_name,
            investment_date: investmentDate,
            amount: investmentAmount,
            terms: investmentTerms,
            other_funders: otherFunders || null,
            founders: activeDeal.founder_names,
            description: ideaSummary || activeDeal.company_description,
            website: activeDeal.website,
            contact_email: activeDeal.primary_email,
            stealthy: false,
            notes: thoughts || null,
          })

        if (investmentError) {
          showToast('Error creating investment: ' + investmentError.message, 'error')
          setDecisionLoading(false)
          return
        }

        // Update application and company stages
        await supabase
          .from('saifcrm_applications')
          .update({ stage: 'portfolio', previous_stage: 'interview' })
          .eq('id', activeDeal.id)

        await supabase
          .from('saif_companies')
          .update({ stage: 'portfolio' })
          .eq('id', company.id)

        showToast('Investment recorded and added to portfolio!', 'success')
      } else if (decision === 'no') {
        // Handle rejection
        await supabase
          .from('saifcrm_applications')
          .update({
            stage: 'rejected',
            previous_stage: 'interview',
            email_sender_id: rejectionEmailSender,
            email_sent: false,
          })
          .eq('id', activeDeal.id)

        await supabase
          .from('saif_companies')
          .update({ stage: 'passed' })
          .eq('id', company.id)

        // Create rejection email ticket
        const ticketTitle = `Send rejection email: ${activeDeal.company_name}`
        await supabase.from('saif_tickets').insert({
          title: ticketTitle,
          description: `Send rejection email to ${activeDeal.company_name} (rejected from interviews).`,
          status: 'open',
          priority: 'medium',
          assigned_to: rejectionEmailSender,
          created_by: currentPersonId,
          tags: ['email-follow-up', 'rejected', 'interview'],
          application_id: activeDeal.id,
        })

        // Trigger email generation
        fetch('/api/generate-rejection-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ applicationId: activeDeal.id }),
        }).catch(console.error)

        showToast('Application rejected - email task assigned', 'success')
      } else {
        showToast('Deliberation saved', 'success')
      }

      setShowDecisionModal(false)
      router.refresh()
    } catch (err) {
      showToast('An unexpected error occurred', 'error')
    }
    setDecisionLoading(false)
  }

  const handleAddFounder = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddingFounder(true)
    setError(null)

    try {
      // Check if person already exists by email
      let personId = null

      if (newFounder.email) {
        const { data: existingPerson } = await supabase
          .from('saif_people')
          .select('id, role')
          .eq('email', newFounder.email)
          .single()

        if (existingPerson) {
          personId = existingPerson.id

          // Update role to 'founder' if they're not already a founder or partner
          // (partner is a higher-priority role that shouldn't be downgraded)
          if (existingPerson.role !== 'founder' && existingPerson.role !== 'partner') {
            await supabase
              .from('saif_people')
              .update({ role: 'founder' })
              .eq('id', existingPerson.id)
          }
        }
      }

      // Create new person if doesn't exist
      if (!personId) {
        // Portfolio company founders get 'pending' status (awaiting signup), others get 'tracked'
        const founderStatus = company.stage === 'portfolio' ? 'pending' : 'tracked'
        const { data: createdPerson, error: createError } = await supabase
          .from('saif_people')
          .insert({
            first_name: newFounder.first_name,
            last_name: newFounder.last_name,
            email: newFounder.email || null,
            role: 'founder',
            status: founderStatus,
          })
          .select()
          .single()

        if (createError) throw createError
        personId = createdPerson.id
      }

      // Check if person is already linked as a founder to this company
      const { data: existingLink } = await supabase
        .from('saif_company_people')
        .select('id, end_date')
        .eq('company_id', company.id)
        .eq('user_id', personId)
        .eq('relationship_type', 'founder')
        .single()

      if (existingLink && !existingLink.end_date) {
        // Already an active founder
        setError('This person is already listed as a founder of this company.')
        setAddingFounder(false)
        return
      }

      if (existingLink && existingLink.end_date) {
        // Was a former founder - reactivate by clearing end_date
        const { error: reactivateError } = await supabase
          .from('saif_company_people')
          .update({ end_date: null, title: newFounder.title || null })
          .eq('id', existingLink.id)

        if (reactivateError) throw reactivateError
      } else {
        // Link founder to company (new relationship)
        const { error: linkError } = await supabase
          .from('saif_company_people')
          .insert({
            company_id: company.id,
            user_id: personId,
            relationship_type: 'founder',
            title: newFounder.title || null,
            is_primary_contact: false,
          })

        if (linkError) throw linkError
      }

      setSuccess('Founder added successfully!')
      setShowAddFounder(false)
      setNewFounder({ first_name: '', last_name: '', email: '', title: '' })

      // Refresh the page
      setTimeout(() => {
        router.refresh()
      }, 1000)
    } catch (err: any) {
      console.error('Error adding founder:', err)
      const errorMessage = err?.message || err?.error?.message || 'Unknown error'
      const errorDetails = err?.details || err?.error?.details || ''
      setError(`Failed to add founder: ${errorMessage}${errorDetails ? ` (${errorDetails})` : ''}`)
    } finally {
      setAddingFounder(false)
    }
  }

  const handleRemoveFounder = async (founderLinkId: string, personName: string) => {
    if (!confirm(`Are you sure you want to remove ${personName} as a founder?`)) {
      return
    }

    setError(null)

    try {
      // Set end_date to mark as former founder (soft delete)
      const { error: updateError } = await supabase
        .from('saif_company_people')
        .update({ end_date: new Date().toISOString() })
        .eq('id', founderLinkId)

      if (updateError) throw updateError

      setSuccess('Founder removed successfully!')

      // Refresh the page
      setTimeout(() => {
        router.refresh()
      }, 1000)
    } catch (err: any) {
      console.error('Error removing founder:', err)
      const errorMessage = err?.message || err?.error?.message || 'Unknown error'
      setError(`Failed to remove founder: ${errorMessage}`)
    }
  }

  // Get current and former founders
  const currentFounders = company.people?.filter(
    (cp) => cp.relationship_type === 'founder' && cp.person && !cp.end_date
  ) || []

  const formerFounders = company.people?.filter(
    (cp) => cp.relationship_type === 'founder' && cp.person && cp.end_date
  ) || []

  const otherTeam = company.people?.filter(
    (cp) => cp.relationship_type !== 'founder' && cp.person
  ) || []

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back link */}
      <Link
        href="/companies"
        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-6"
      >
        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Companies
      </Link>

      {/* Header with Logo and Edit Button */}
      <div className="mb-8 flex items-start justify-between">
        <div className="flex items-start space-x-6">
          {/* Company Logo */}
          <div className="flex-shrink-0">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={company.name}
                className="h-24 w-24 object-contain border border-gray-200 rounded-lg p-2"
              />
            ) : (
              <div className="h-24 w-24 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
                <span className="text-3xl font-bold text-gray-400">
                  {company.name[0]}
                </span>
              </div>
            )}
            {isEditing && (
              <div className="mt-2">
                <label
                  htmlFor="logo-upload"
                  className="cursor-pointer inline-flex items-center px-3 py-1 border border-gray-300 rounded-md shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  {uploadingLogo ? 'Uploading...' : 'Change Logo'}
                </label>
                <input
                  id="logo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={uploadingLogo}
                  className="hidden"
                />
              </div>
            )}
          </div>

          {/* Company Name and Basic Info */}
          <div>
            <h1 className="text-4xl font-bold text-gray-900">{company.name}</h1>
            {company.previous_names && company.previous_names.length > 0 && (
              <p className="text-sm text-gray-500 mt-1">
                Formerly: {company.previous_names.join(', ')}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {company.industry && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  {company.industry}
                </span>
              )}
              {company.yc_batch && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                  YC {company.yc_batch}
                </span>
              )}
              {company.is_aisafety_company && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  AI Safety
                </span>
              )}
              {company.stage && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  {company.stage}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <CreateTicketButton currentUserId={currentPersonId} />
          {canEdit && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800"
            >
              Edit Company
            </button>
          )}
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="mb-6 rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 rounded-md bg-green-50 p-4">
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}

      {/* Edit Form or View Mode */}
      {isEditing ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Company Information */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Company Information</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Company Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                />
              </div>

              <div>
                <label htmlFor="previous_names" className="block text-sm font-medium text-gray-700">
                  Former Names
                </label>
                <input
                  type="text"
                  id="previous_names"
                  name="previous_names"
                  value={formData.previous_names}
                  onChange={handleInputChange}
                  placeholder="e.g. OldCorp, Previous Inc (comma-separated)"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                />
                <p className="mt-1 text-xs text-gray-500">Separate multiple names with commas</p>
              </div>

              <div>
                <label htmlFor="short_description" className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  id="short_description"
                  name="short_description"
                  rows={3}
                  value={formData.short_description}
                  onChange={handleInputChange}
                  placeholder="Brief description of what the company does..."
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                />
              </div>

              <div>
                <label htmlFor="website" className="block text-sm font-medium text-gray-700">
                  Website
                </label>
                <input
                  type="url"
                  id="website"
                  name="website"
                  value={formData.website}
                  onChange={handleInputChange}
                  placeholder="https://company.com"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="industry" className="block text-sm font-medium text-gray-700">
                    Industry
                  </label>
                  <input
                    type="text"
                    id="industry"
                    name="industry"
                    value={formData.industry}
                    onChange={handleInputChange}
                    placeholder="e.g. AI/ML, Enterprise SaaS"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                  />
                </div>

                <div>
                  <label htmlFor="founded_year" className="block text-sm font-medium text-gray-700">
                    Founded Year
                  </label>
                  <input
                    type="number"
                    id="founded_year"
                    name="founded_year"
                    value={formData.founded_year}
                    onChange={handleInputChange}
                    placeholder="2024"
                    min="1900"
                    max="2100"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="city" className="block text-sm font-medium text-gray-700">
                    City
                  </label>
                  <input
                    type="text"
                    id="city"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    placeholder="San Francisco"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                  />
                </div>

                <div>
                  <label htmlFor="country" className="block text-sm font-medium text-gray-700">
                    Country
                  </label>
                  <input
                    type="text"
                    id="country"
                    name="country"
                    value={formData.country}
                    onChange={handleInputChange}
                    placeholder="United States"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="yc_batch" className="block text-sm font-medium text-gray-700">
                    YC Batch
                  </label>
                  <input
                    type="text"
                    id="yc_batch"
                    name="yc_batch"
                    value={formData.yc_batch}
                    onChange={handleInputChange}
                    placeholder="S24, W25, etc."
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                  />
                </div>

                <div>
                  <label htmlFor="stage" className="block text-sm font-medium text-gray-700">
                    Stage
                  </label>
                  <select
                    id="stage"
                    name="stage"
                    value={formData.stage}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                  >
                    <option value="">Select stage...</option>
                    {COMPANY_STAGES.map(stage => (
                      <option key={stage.value} value={stage.value}>{stage.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_aisafety_company"
                  name="is_aisafety_company"
                  checked={formData.is_aisafety_company ?? false}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-gray-900 focus:ring-gray-900 border-gray-300 rounded"
                />
                <label htmlFor="is_aisafety_company" className="ml-2 block text-sm text-gray-700">
                  AI Safety Company
                </label>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tags
                </label>
                <TagSelector
                  selectedTags={formData.tags}
                  onChange={(tags) => setFormData({ ...formData, tags })}
                  currentUserId={currentPersonId}
                />
              </div>

              {/* Biomap Focus Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Biomap Focus Areas
                </label>
                <FocusTagSelector
                  selectedTags={formData.tags}
                  onChange={(tags) => setFormData({ ...formData, tags })}
                  currentUserId={currentPersonId}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Focus areas for the biomap (prevention, detection, treatment, etc.)
                </p>
              </div>
            </div>
          </div>

          {/* Investment Information (Partners Only) */}
          {isPartner && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Investment Details</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="inv_type" className="block text-sm font-medium text-gray-700">
                      Investment Type
                    </label>
                    <select
                      id="inv_type"
                      value={investmentData.type}
                      onChange={(e) => setInvestmentData({ ...investmentData, type: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                    >
                      <option value="">Select type...</option>
                      {INVESTMENT_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="inv_round" className="block text-sm font-medium text-gray-700">
                      Round
                    </label>
                    <select
                      id="inv_round"
                      value={investmentData.round}
                      onChange={(e) => setInvestmentData({ ...investmentData, round: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                    >
                      <option value="">Select round...</option>
                      {INVESTMENT_ROUNDS.map(round => (
                        <option key={round.value} value={round.value}>{round.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="inv_amount" className="block text-sm font-medium text-gray-700">
                      Investment Amount ($)
                    </label>
                    <input
                      type="number"
                      id="inv_amount"
                      value={investmentData.amount}
                      onChange={(e) => setInvestmentData({ ...investmentData, amount: e.target.value })}
                      placeholder="100000"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                    />
                  </div>

                  <div>
                    <label htmlFor="inv_valuation" className="block text-sm font-medium text-gray-700">
                      Post-Money Valuation / Cap ($M)
                    </label>
                    <input
                      type="number"
                      id="inv_valuation"
                      value={investmentData.post_money_valuation}
                      onChange={(e) => setInvestmentData({ ...investmentData, post_money_valuation: e.target.value })}
                      placeholder="10"
                      step="0.1"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                    />
                    <p className="mt-1 text-xs text-gray-500">Enter value in millions (e.g., 10 for $10M)</p>
                  </div>
                </div>

                <div>
                  <label htmlFor="inv_date" className="block text-sm font-medium text-gray-700">
                    Investment Date
                  </label>
                  <input
                    type="date"
                    id="inv_date"
                    value={investmentData.investment_date}
                    onChange={(e) => setInvestmentData({ ...investmentData, investment_date: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setIsEditing(false)
                setError(null)
                setSuccess(null)
                // Reset form data
                setFormData({
                  name: company.name,
                  previous_names: company.previous_names?.join(', ') || '',
                  short_description: company.short_description || '',
                  website: company.website || '',
                  industry: company.industry || '',
                  founded_year: company.founded_year?.toString() || '',
                  city: company.city || '',
                  country: company.country || '',
                  yc_batch: company.yc_batch || '',
                  is_aisafety_company: company.is_aisafety_company,
                  tags: company.tags || [],
                  stage: company.stage || '',
                })
                // Reset investment data
                const inv = company.investments?.[0]
                setInvestmentData({
                  id: inv?.id || null,
                  type: inv?.type?.toLowerCase() || '',
                  round: inv?.round || '',
                  amount: inv?.amount?.toString() || '',
                  post_money_valuation: inv?.post_money_valuation ? (inv.post_money_valuation / 1000000).toString() : '',
                  investment_date: inv?.investment_date?.split('T')[0] || '',
                })
              }}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

          {/* Delete Button (Partners Only) */}
          {isPartner && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Delete this company
              </button>
            </div>
          )}
        </form>
      ) : (
        /* View Mode */
        <div className="space-y-6">
          {/* Company Details */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">About</h2>

            {company.short_description ? (
              <p className="text-gray-700 mb-6">{company.short_description}</p>
            ) : (
              <p className="text-gray-500 italic mb-6">No description available</p>
            )}

            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {company.website && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Website</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    <a
                      href={ensureProtocol(company.website)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-900 hover:text-gray-700 underline"
                    >
                      {company.website}
                    </a>
                  </dd>
                </div>
              )}

              {company.industry && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Industry</dt>
                  <dd className="mt-1 text-sm text-gray-900">{company.industry}</dd>
                </div>
              )}

              {company.founded_year && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Founded</dt>
                  <dd className="mt-1 text-sm text-gray-900">{company.founded_year}</dd>
                </div>
              )}

              {(company.city || company.country) && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Location</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {[company.city, company.country].filter(Boolean).join(', ')}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Tags */}
          {company.tags && company.tags.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Tags</h2>
              <div className="flex flex-wrap gap-2">
                {company.tags.map((tag, index) => (
                  <span key={index} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Founders */}
          {currentFounders.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  {currentFounders.length === 1 ? 'Founder' : 'Founders'}
                </h2>
                {canEdit && !isEditing && (
                  <button
                    onClick={() => setShowAddFounder(true)}
                    className="text-sm text-gray-600 hover:text-gray-900 underline"
                  >
                    + Add Founder
                  </button>
                )}
              </div>

              {/* Add Founder Form */}
              {showAddFounder && canEdit && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Add New Founder</h3>
                  <form onSubmit={handleAddFounder} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="First Name *"
                        required
                        value={newFounder.first_name}
                        onChange={(e) => setNewFounder({ ...newFounder, first_name: e.target.value })}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                      />
                      <input
                        type="text"
                        placeholder="Last Name *"
                        required
                        value={newFounder.last_name}
                        onChange={(e) => setNewFounder({ ...newFounder, last_name: e.target.value })}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                      />
                    </div>
                    <input
                      type="email"
                      placeholder="Email (optional)"
                      value={newFounder.email}
                      onChange={(e) => setNewFounder({ ...newFounder, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                    />
                    <input
                      type="text"
                      placeholder="Title (e.g., Co-Founder & CEO)"
                      value={newFounder.title}
                      onChange={(e) => setNewFounder({ ...newFounder, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={addingFounder}
                        className="px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-800 disabled:opacity-50"
                      >
                        {addingFounder ? 'Adding...' : 'Add Founder'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddFounder(false)
                          setNewFounder({ first_name: '', last_name: '', email: '', title: '' })
                        }}
                        className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="space-y-4">
                {currentFounders.map((founder) => {
                  const person = founder.person
                  if (!person) return null

                  return (
                    <div key={founder.id} className="flex items-start space-x-4">
                      <button
                        onClick={() => setSelectedPersonId(person.id)}
                        className="flex-shrink-0 hover:opacity-80 transition-opacity"
                      >
                        {person.avatar_url ? (
                          <img
                            src={person.avatar_url}
                            alt={`${person.first_name} ${person.last_name}`}
                            className="h-12 w-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center">
                            <span className="text-lg text-gray-600">
                              {person.first_name?.[0] || '?'}
                            </span>
                          </div>
                        )}
                      </button>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <button
                              onClick={() => setSelectedPersonId(person.id)}
                              className="text-sm font-semibold text-gray-900 hover:underline text-left"
                            >
                              {person.first_name} {person.last_name}
                            </button>
                            {(founder.title || person.title) && (
                              <p className="text-sm text-gray-600">
                                {founder.title || person.title}
                              </p>
                            )}
                          </div>
                          {canEdit && !isEditing && (
                            <button
                              onClick={() => handleRemoveFounder(founder.id, `${person.first_name} ${person.last_name}`)}
                              className="text-xs text-red-600 hover:text-red-800"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        {person.bio && (
                          <p className="mt-2 text-sm text-gray-700">{person.bio}</p>
                        )}
                        {person.location && (
                          <p className="mt-1 text-xs text-gray-500">{person.location}</p>
                        )}
                        <div className="mt-2 flex gap-3">
                          {person.linkedin_url && (
                            <a
                              href={person.linkedin_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-gray-600 hover:text-gray-900 underline"
                            >
                              LinkedIn
                            </a>
                          )}
                          {person.twitter_url && (
                            <a
                              href={person.twitter_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-gray-600 hover:text-gray-900 underline"
                            >
                              Twitter
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Former Founders (Partners Only) */}
          {isPartner && formerFounders.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Former {formerFounders.length === 1 ? 'Founder' : 'Founders'}
              </h2>
              <div className="space-y-3">
                {formerFounders.map((founder) => {
                  const person = founder.person
                  if (!person) return null

                  return (
                    <div key={founder.id} className="flex items-center space-x-3 opacity-60">
                      <button
                        onClick={() => setSelectedPersonId(person.id)}
                        className="flex-shrink-0 hover:opacity-80 transition-opacity"
                      >
                        {person.avatar_url ? (
                          <img
                            src={person.avatar_url}
                            alt={`${person.first_name} ${person.last_name}`}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                            <span className="text-sm text-gray-600">
                              {person.first_name?.[0] || '?'}
                            </span>
                          </div>
                        )}
                      </button>
                      <div className="flex-1">
                        <button
                          onClick={() => setSelectedPersonId(person.id)}
                          className="text-sm font-medium text-gray-900 hover:underline text-left"
                        >
                          {person.first_name} {person.last_name}
                        </button>
                        <p className="text-xs text-gray-500">
                          {founder.title || person.title || 'Former Founder'}
                          {founder.end_date && ` • Left ${new Date(founder.end_date).toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Other Team Members */}
          {(otherTeam.length > 0 || isPartner) && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Team</h2>
                {isPartner && (
                  <button
                    onClick={() => setShowAddPersonModal(true)}
                    className="text-sm text-gray-600 hover:text-gray-900 underline"
                  >
                    + Add Person
                  </button>
                )}
              </div>
              {otherTeam.length > 0 ? (
                <div className="space-y-3">
                  {otherTeam.map((member) => {
                    const person = member.person
                    if (!person) return null

                    return (
                      <div key={member.id} className="flex items-center space-x-3">
                        <button
                          onClick={() => setSelectedPersonId(person.id)}
                          className="flex-shrink-0 hover:opacity-80 transition-opacity"
                        >
                          {person.avatar_url ? (
                            <img
                              src={person.avatar_url}
                              alt={`${person.first_name} ${person.last_name}`}
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                              <span className="text-sm text-gray-600">
                                {person.first_name?.[0] || '?'}
                              </span>
                            </div>
                          )}
                        </button>
                        <div>
                          <button
                            onClick={() => setSelectedPersonId(person.id)}
                            className="text-sm font-medium text-gray-900 hover:underline text-left"
                          >
                            {person.first_name} {person.last_name}
                          </button>
                          <p className="text-xs text-gray-500">
                            {member.title || member.relationship_type}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">No team members yet. Click "Add Person" to add someone.</p>
              )}
            </div>
          )}

          {/* Investment Info (Partners Only) */}
          {isPartner && company.investments && company.investments.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Investment</h2>
              <div className="space-y-4">
                {company.investments.map((investment: any) => {
                  // Format valuation display
                  const valuationDisplay = investment.post_money_valuation
                    ? `$${(investment.post_money_valuation / 1000000).toFixed(0)}M`
                    : null

                  // Get display label for type
                  const typeLabel = INVESTMENT_TYPES.find(t => t.value === investment.type?.toLowerCase())?.label || investment.type

                  return (
                    <div key={investment.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                      {/* Amount */}
                      <span className="text-2xl font-bold text-gray-900">
                        ${investment.amount?.toLocaleString() || '—'}
                      </span>

                      {/* Type + Round + Valuation as badges */}
                      <div className="flex flex-wrap items-center gap-2">
                        {investment.round && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {investment.round}
                          </span>
                        )}
                        {typeLabel && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {typeLabel}
                          </span>
                        )}
                        {valuationDisplay && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {valuationDisplay} {investment.type?.toLowerCase() === 'safe' ? 'cap' : 'post'}
                          </span>
                        )}
                        {investment.status && investment.status !== 'active' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            {investment.status}
                          </span>
                        )}
                      </div>

                      {/* Date */}
                      {investment.investment_date && (
                        <span className="text-sm text-gray-500">
                          {new Date(investment.investment_date).toLocaleDateString('en-US', {
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Exit Info - shown separately if exists */}
          {isPartner && company.investments?.some((inv: any) => inv.exit_date) && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Exit</h2>
              {company.investments.filter((inv: any) => inv.exit_date).map((investment: any) => (
                <div key={investment.id} className="text-sm text-gray-700">
                  <span className="font-medium text-green-700">Exited:</span>{' '}
                  {new Date(investment.exit_date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                  {investment.acquirer && ` → ${investment.acquirer}`}
                </div>
              ))}
            </div>
          )}

          {/* Active Deal Section */}
          {isPartner && activeDeal && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Active Deal</h2>
                    <p className="text-sm text-gray-500">Interview stage</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDecisionModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Make Decision
                </button>
              </div>

              {/* Vote Summary */}
              {activeDeal.votes.length > 0 && (
                <div className="mb-4">
                  <div className="flex gap-3 items-center mb-3">
                    <div className="flex items-center gap-2 bg-emerald-100 px-3 py-1.5 rounded-lg">
                      <span className="text-emerald-700 font-semibold">{activeDeal.votes.filter(v => v.vote === 'yes').length}</span>
                      <span className="text-emerald-600 text-sm">Yes</span>
                    </div>
                    <div className="flex items-center gap-2 bg-amber-100 px-3 py-1.5 rounded-lg">
                      <span className="text-amber-700 font-semibold">{activeDeal.votes.filter(v => v.vote === 'maybe').length}</span>
                      <span className="text-amber-600 text-sm">Maybe</span>
                    </div>
                    <div className="flex items-center gap-2 bg-red-100 px-3 py-1.5 rounded-lg">
                      <span className="text-red-700 font-semibold">{activeDeal.votes.filter(v => v.vote === 'no').length}</span>
                      <span className="text-red-600 text-sm">No</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {activeDeal.votes.map((vote) => (
                      <div key={vote.oduserId} className="flex items-center gap-3 bg-white/60 rounded-lg p-3">
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
                          {vote.userName.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <span className="text-sm font-medium text-gray-900">{vote.userName}</span>
                          {vote.notes && <p className="text-xs text-gray-500 mt-0.5">{vote.notes}</p>}
                        </div>
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                          vote.vote === 'yes' ? 'bg-emerald-100 text-emerald-700' :
                          vote.vote === 'maybe' ? 'bg-amber-100 text-amber-700' :
                          vote.vote === 'no' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {vote.vote}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Deliberation Summary */}
              {activeDeal.deliberation && (
                <div className="bg-white/60 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-gray-700">Decision:</span>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      activeDeal.deliberation.decision === 'yes' ? 'bg-emerald-500 text-white' :
                      activeDeal.deliberation.decision === 'maybe' ? 'bg-amber-500 text-white' :
                      activeDeal.deliberation.decision === 'no' ? 'bg-red-500 text-white' :
                      'bg-gray-200 text-gray-700'
                    }`}>
                      {activeDeal.deliberation.decision.toUpperCase()}
                    </span>
                  </div>
                  {activeDeal.deliberation.idea_summary && (
                    <p className="text-sm text-gray-600">{activeDeal.deliberation.idea_summary}</p>
                  )}
                </div>
              )}

              {/* Links */}
              <div className="flex flex-wrap gap-2 mt-4">
                {activeDeal.deck_link && (
                  <a
                    href={activeDeal.deck_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <span>📊</span> Deck
                  </a>
                )}
                <Link
                  href={`/deals/${activeDeal.id}`}
                  className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                >
                  View Full Details →
                </Link>
              </div>
            </div>
          )}

          {/* Notes Section */}
          {isPartner && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {activeDeal ? 'Deal Notes' : company.stage === 'portfolio' ? 'Portfolio Notes' : 'Notes'}
              </h2>
              <CompanyNotes
                companyId={company.id}
                companyName={company.name}
                userId={currentPersonId}
                userName={userName}
                contextType={activeDeal ? 'deal' : company.stage === 'portfolio' ? 'portfolio' : 'company'}
                contextId={activeDeal?.id || (company.stage === 'portfolio' && company.investments?.[0]?.id) || undefined}
                deliberationNotes={activeDeal?.deliberation?.thoughts}
              />
            </div>
          )}

        </div>
      )}

      {/* Person Modal */}
      {selectedPersonId && (
        <PersonModal
          personId={selectedPersonId}
          onClose={() => setSelectedPersonId(null)}
        />
      )}

      {/* Add Person to Company Modal */}
      <AddPersonToCompanyModal
        companyId={company.id}
        companyName={company.name}
        existingPeopleIds={company.people?.map(p => p.person?.id).filter((id): id is string => Boolean(id)) || []}
        isOpen={showAddPersonModal}
        onClose={() => setShowAddPersonModal(false)}
        onSuccess={() => {
          setShowAddPersonModal(false)
          router.refresh()
        }}
        currentUserId={currentPersonId}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Company</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete <strong>{company.name}</strong>? This will also delete all associated investments and team member links. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decision Modal */}
      {showDecisionModal && activeDeal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => !decisionLoading && setShowDecisionModal(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{company.name}</h2>
                  <p className="text-gray-500 mt-1">Add deliberation notes and final decision</p>
                </div>
                <button onClick={() => !decisionLoading && setShowDecisionModal(false)} className="text-gray-400 hover:text-gray-600 p-2 -m-2">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Meeting Date</label>
                  <input type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
                    <option value="scheduled">Scheduled</option>
                    <option value="met">Met</option>
                    <option value="emailed">Emailed</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Idea Summary</label>
                <textarea value={ideaSummary} onChange={(e) => setIdeaSummary(e.target.value)} rows={3} className="input resize-none" placeholder="Brief summary of the company's idea..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Thoughts & Notes</label>
                <textarea value={thoughts} onChange={(e) => setThoughts(e.target.value)} rows={4} className="input resize-none" placeholder="Discussion notes, concerns, opportunities..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Final Decision</label>
                <div className="flex gap-3">
                  {[
                    { value: 'pending', label: 'Pending', icon: '⏳', color: 'gray' },
                    { value: 'yes', label: 'Yes', icon: '✅', color: 'emerald' },
                    { value: 'maybe', label: 'Maybe', icon: '🤔', color: 'amber' },
                    { value: 'no', label: 'No', icon: '❌', color: 'red' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setDecision(option.value)}
                      className={`flex-1 py-3 px-4 rounded-xl border-2 font-semibold text-center transition-all ${
                        decision === option.value
                          ? option.color === 'emerald' ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                            : option.color === 'amber' ? 'border-amber-500 bg-amber-50 text-amber-700'
                            : option.color === 'red' ? 'border-red-500 bg-red-50 text-red-700'
                            : 'border-gray-400 bg-gray-50 text-gray-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="text-xl mb-1">{option.icon}</div>
                      <div>{option.label}</div>
                    </button>
                  ))}
                </div>
              </div>
              {decision === 'yes' && (
                <div className="bg-emerald-50 rounded-xl p-6 border-2 border-emerald-200">
                  <h3 className="text-lg font-semibold text-emerald-800 mb-4">💰 Investment Details</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-emerald-800 mb-1.5">Investment Amount *</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <input type="number" value={investmentAmount || ''} onChange={(e) => setInvestmentAmount(e.target.value ? parseFloat(e.target.value) : null)} className="input pl-7" placeholder="100000" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-emerald-800 mb-1.5">Investment Date *</label>
                      <input type="date" value={investmentDate} onChange={(e) => setInvestmentDate(e.target.value)} className="input" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-emerald-800 mb-1.5">Terms *</label>
                    <input type="text" value={investmentTerms} onChange={(e) => setInvestmentTerms(e.target.value)} className="input" />
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-emerald-800 mb-1.5">Co-Investors (optional)</label>
                    <input type="text" value={otherFunders} onChange={(e) => setOtherFunders(e.target.value)} className="input" />
                  </div>
                </div>
              )}
              {decision === 'no' && (
                <div className="bg-red-50 rounded-xl p-6 border-2 border-red-200">
                  <h3 className="text-lg font-semibold text-red-800 mb-4">✉️ Rejection Email</h3>
                  <p className="text-sm text-red-700 mb-4">Select who will send the rejection email to the founders.</p>
                  <div>
                    <label className="block text-sm font-medium text-red-800 mb-1.5">Email Sender *</label>
                    <select value={rejectionEmailSender} onChange={(e) => setRejectionEmailSender(e.target.value)} className="input">
                      <option value="">Select a partner...</option>
                      {partners.map((partner) => (
                        <option key={partner.id} value={partner.id}>{partner.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button onClick={() => setShowDecisionModal(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50" disabled={decisionLoading}>Cancel</button>
              <button onClick={handleSaveDecision} disabled={decisionLoading} className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {decisionLoading ? 'Saving...' : 'Save Decision'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
