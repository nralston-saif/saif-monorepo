'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@saif/ui'
import type { TicketStatus, TicketPriority } from '@/lib/types/database'
import TagSelector from './TagSelector'

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
}

type FormData = {
  title: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  due_date: string
  assigned_to: string
  related_company: string
  related_person: string
  tags: string[]
}

export default function TicketDetailModal({
  ticket,
  partners,
  companies,
  people,
  onClose,
  onUpdate,
}: {
  ticket: Ticket
  partners: Partner[]
  companies: Company[]
  people: Person[]
  onClose: () => void
  onUpdate: () => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    title: ticket.title,
    description: ticket.description || '',
    status: ticket.status,
    priority: ticket.priority,
    due_date: ticket.due_date || '',
    assigned_to: ticket.assigned_to || '',
    related_company: ticket.related_company || '',
    related_person: ticket.related_person || '',
    tags: ticket.tags || [],
  })
  const [loading, setLoading] = useState(false)

  const supabase = createClient()
  const { showToast } = useToast()

  const getPartnerName = (partner: Partner | null | undefined) => {
    if (!partner) return 'Unassigned'
    if (partner.first_name && partner.last_name) {
      return `${partner.first_name} ${partner.last_name}`
    }
    return partner.email || 'Unknown'
  }

  const getPersonName = (person: Person) => {
    if (person.first_name && person.last_name) {
      return `${person.first_name} ${person.last_name}`
    }
    return person.email || 'Unknown'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const formatDateShort = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title.trim()) {
      showToast('Title is required', 'error')
      return
    }

    setLoading(true)

    const { error } = await supabase
      .from('saif_tickets')
      .update({
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        status: formData.status,
        priority: formData.priority,
        due_date: formData.due_date || null,
        assigned_to: formData.assigned_to || null,
        related_company: formData.related_company || null,
        related_person: formData.related_person || null,
        tags: formData.tags.length > 0 ? formData.tags : null,
      })
      .eq('id', ticket.id)

    setLoading(false)

    if (error) {
      showToast('Failed to update ticket', 'error')
      console.error(error)
    } else {
      showToast('Ticket updated successfully', 'success')
      setIsEditing(false)
      onUpdate()
    }
  }

  const handleDelete = async () => {
    setLoading(true)

    const { error } = await supabase
      .from('saif_tickets')
      .delete()
      .eq('id', ticket.id)

    setLoading(false)

    if (error) {
      showToast('Failed to delete ticket', 'error')
      console.error(error)
    } else {
      showToast('Ticket deleted successfully', 'success')
      onUpdate()
    }
  }

  const handleQuickStatusChange = async (newStatus: TicketStatus) => {
    setLoading(true)

    const { error } = await supabase
      .from('saif_tickets')
      .update({ status: newStatus })
      .eq('id', ticket.id)

    setLoading(false)

    if (error) {
      showToast('Failed to update status', 'error')
      console.error(error)
    } else {
      showToast('Status updated successfully', 'success')
      onUpdate()
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content max-w-3xl" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {isEditing ? (
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="text-2xl font-bold text-gray-900 w-full border-b-2 border-gray-300 focus:outline-none focus:border-gray-900"
                  placeholder="Ticket title"
                />
              ) : (
                <h2 className="text-2xl font-bold text-gray-900">{ticket.title}</h2>
              )}
              <div className="flex items-center gap-2 mt-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${getStatusColor(ticket.status)}`}>
                  {ticket.status.replace('_', ' ')}
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${getPriorityColor(ticket.priority)}`}>
                  {ticket.priority}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-2 -m-2 ml-4"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        {isEditing ? (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                rows={4}
                placeholder="Add details about this ticket..."
              />
            </div>

            {/* Two-column layout for dropdowns */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as TicketPriority })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as TicketStatus })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>

            {/* Due Date & Assigned To */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assign To
                </label>
                <select
                  value={formData.assigned_to}
                  onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                >
                  <option value="">Unassigned</option>
                  {partners.map(partner => (
                    <option key={partner.id} value={partner.id}>
                      {getPartnerName(partner)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Related Company & Person */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Related Company
                </label>
                <select
                  value={formData.related_company}
                  onChange={(e) => setFormData({ ...formData, related_company: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                >
                  <option value="">None</option>
                  {companies.map(company => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Related Person
                </label>
                <select
                  value={formData.related_person}
                  onChange={(e) => setFormData({ ...formData, related_person: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                >
                  <option value="">None</option>
                  {people.map(person => (
                    <option key={person.id} value={person.id}>
                      {getPersonName(person)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tags
              </label>
              <TagSelector
                selectedTags={formData.tags}
                onChange={(tags) => setFormData({ ...formData, tags })}
                currentUserId={ticket.created_by}
              />
            </div>
          </form>
        ) : (
          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {/* Description */}
            {ticket.description && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Description</h3>
                <p className="text-gray-900 whitespace-pre-wrap">{ticket.description}</p>
              </div>
            )}

            {/* Quick actions */}
            {ticket.status !== 'archived' && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Quick Actions</h3>
                <div className="flex flex-wrap gap-2">
                  {ticket.status !== 'in_progress' && (
                    <button
                      onClick={() => handleQuickStatusChange('in_progress')}
                      className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-200 transition-colors"
                      disabled={loading}
                    >
                      Mark In Progress
                    </button>
                  )}
                  <button
                    onClick={() => handleQuickStatusChange('archived')}
                    className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-200 transition-colors"
                    disabled={loading}
                  >
                    Archive (Mark Complete)
                  </button>
                </div>
              </div>
            )}

            {/* Details */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Assigned To</h3>
                <p className="text-gray-900">{getPartnerName(ticket.assigned_partner)}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Due Date</h3>
                <p className="text-gray-900">{ticket.due_date ? formatDateShort(ticket.due_date) : 'No due date'}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Related Company</h3>
                <p className="text-gray-900">{ticket.company?.name || 'None'}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Related Person</h3>
                <p className="text-gray-900">{ticket.person ? getPersonName(ticket.person) : 'None'}</p>
              </div>
            </div>

            {/* Tags */}
            {ticket.tags && ticket.tags.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {ticket.tags.map((tag, index) => (
                    <span key={index} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="pt-6 border-t border-gray-100 space-y-2 text-sm text-gray-500">
              <p>Created by {getPartnerName(ticket.creator)} on {formatDate(ticket.created_at)}</p>
              <p>Last updated {formatDate(ticket.updated_at)}</p>
              {ticket.archived_at && (
                <p>Archived on {formatDate(ticket.archived_at)}</p>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-between">
          <div>
            {!isEditing && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors"
                disabled={loading}
              >
                Delete
              </button>
            )}
          </div>
          <div className="flex gap-3">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false)
                    setFormData({
                      title: ticket.title,
                      description: ticket.description || '',
                      status: ticket.status,
                      priority: ticket.priority,
                      due_date: ticket.due_date || '',
                      assigned_to: ticket.assigned_to || '',
                      related_company: ticket.related_company || '',
                      related_person: ticket.related_person || '',
                      tags: ticket.tags || [],
                    })
                  }}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-black font-medium transition-colors disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-black font-medium transition-colors"
              >
                Edit Ticket
              </button>
            )}
          </div>
        </div>

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-2xl">
            <div className="bg-white rounded-xl p-6 max-w-sm mx-4">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Ticket?</h3>
              <p className="text-gray-600 mb-4">
                Are you sure you want to delete this ticket? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
