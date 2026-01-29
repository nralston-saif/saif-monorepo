'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import FocusTagSelector from '@/components/FocusTagSelector'
import type { BioMapPerson, BioMapOrganization, FocusTag } from './page'

const ENTITY_TYPE_LABELS: Record<string, string> = {
  for_profit: 'For-Profit',
  pbc: 'Public Benefit Corp',
  nonprofit: 'Nonprofit',
  government: 'Government',
  other: 'Other',
}

const ROLE_LABELS: Record<string, string> = {
  partner: 'Partner',
  founder: 'Founder',
  advisor: 'Advisor',
  employee: 'Employee',
  board_member: 'Board Member',
  investor: 'Investor',
  contact: 'Contact',
}

type Props = {
  organization?: BioMapOrganization | null
  person?: BioMapPerson | null
  focusTags: FocusTag[]
  userId: string
  onClose: () => void
  onUpdate?: () => void
}

export default function BioMapDetailModal({ organization, person, focusTags, userId, onClose, onUpdate }: Props) {
  const router = useRouter()
  const supabase = createClient()

  // Get initial tags
  const initialTags = organization?.tags || person?.tags || []
  const [tags, setTags] = useState<string[]>(initialTags)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  // Handle close - refresh if changes were made
  const handleClose = () => {
    if (hasChanges && onUpdate) {
      onUpdate()
    }
    onClose()
  }

  if (!organization && !person) return null

  const getBioTags = (tagList: string[]): string[] => {
    return tagList.filter(t => t.toLowerCase().includes('bio'))
  }

  const focusTagNames = focusTags.map(t => t.name.toLowerCase())

  const getFocusTags = (tagList: string[]): { name: string; color: string }[] => {
    return tagList
      .filter(t => focusTagNames.includes(t.toLowerCase()))
      .map(t => {
        const focusTag = focusTags.find(ft => ft.name.toLowerCase() === t.toLowerCase())
        return {
          name: t,
          color: focusTag?.color || '#6B7280',
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  const handleTagsChange = async (newTags: string[]) => {
    setTags(newTags)
    setSaving(true)
    setError(null)

    try {
      if (organization) {
        const { error: updateError } = await supabase
          .from('saif_companies')
          .update({ tags: newTags, updated_at: new Date().toISOString() })
          .eq('id', organization.id)

        if (updateError) throw updateError
      } else if (person) {
        const { error: updateError } = await supabase
          .from('saif_people')
          .update({ tags: newTags, updated_at: new Date().toISOString() })
          .eq('id', person.id)

        if (updateError) throw updateError
      }

      // Mark that changes were made (will refresh on close)
      setHasChanges(true)
    } catch (err: any) {
      console.error('Error saving tags:', err)
      setError(err?.message || 'Failed to save tags')
      // Revert to previous tags on error
      setTags(tags)
    } finally {
      setSaving(false)
    }
  }

  if (organization) {
    return (
      <div className="modal-backdrop" onClick={handleClose}>
        <div className="modal-content max-w-2xl" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900">{organization.name}</h2>
                {organization.entity_type && (
                  <span className="inline-block mt-2 px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                    {ENTITY_TYPE_LABELS[organization.entity_type] || organization.entity_type}
                  </span>
                )}
              </div>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 p-2 -m-2 ml-4"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Focus/Tags - Always visible in header */}
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-medium text-gray-500">Focus</h3>
                {saving && <span className="text-xs text-gray-400">(saving...)</span>}
              </div>
              {error && (
                <p className="text-xs text-red-600 mb-2">{error}</p>
              )}
              <FocusTagSelector
                selectedTags={tags}
                onChange={handleTagsChange}
                currentUserId={userId}
                availableFocusTags={focusTags}
              />
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6 max-h-[50vh] overflow-y-auto">
            {/* Description */}
            {organization.short_description && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Description</h3>
                <p className="text-gray-900">{organization.short_description}</p>
              </div>
            )}

            {/* Location */}
            {(organization.city || organization.country) && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Location</h3>
                <p className="text-gray-900">
                  {[organization.city, organization.country].filter(Boolean).join(', ')}
                </p>
              </div>
            )}

            {/* Website */}
            {organization.website && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Website</h3>
                <a
                  href={organization.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {organization.website}
                </a>
              </div>
            )}

            {/* Contacts */}
            {organization.contacts.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Contacts</h3>
                <div className="space-y-3">
                  {organization.contacts.map(contact => (
                    <div key={contact.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{contact.name}</p>
                        {contact.title && (
                          <p className="text-sm text-gray-500">{contact.title}</p>
                        )}
                        {contact.relationship_type && (
                          <p className="text-xs text-gray-400 capitalize">{contact.relationship_type.replace('_', ' ')}</p>
                        )}
                      </div>
                      {contact.email && (
                        <a
                          href={`mailto:${contact.email}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          {contact.email}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Founded Year */}
            {organization.founded_year && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Founded</h3>
                <p className="text-gray-900">{organization.founded_year}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-100 flex justify-between">
            <button
              onClick={() => router.push(`/companies/${organization.id}`)}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              View Full Profile
            </button>
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (person) {
    return (
      <div className="modal-backdrop" onClick={handleClose}>
        <div className="modal-content max-w-2xl" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-[#1a1a1a] rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-2xl font-medium">
                    {person.displayName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{person.displayName}</h2>
                  {person.title && (
                    <p className="text-gray-500 mt-1">{person.title}</p>
                  )}
                </div>
              </div>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 p-2 -m-2 ml-4"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Focus/Tags - Always visible in header */}
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-medium text-gray-500">Focus</h3>
                {saving && <span className="text-xs text-gray-400">(saving...)</span>}
              </div>
              {error && (
                <p className="text-xs text-red-600 mb-2">{error}</p>
              )}
              <FocusTagSelector
                selectedTags={tags}
                onChange={handleTagsChange}
                currentUserId={userId}
                availableFocusTags={focusTags}
              />
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6 max-h-[50vh] overflow-y-auto">
            {/* Role */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Role</h3>
              <span className="px-3 py-1 text-sm font-medium rounded-full bg-blue-100 text-blue-800">
                {ROLE_LABELS[person.role] || person.role}
              </span>
            </div>

            {/* Bio */}
            {person.bio && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Bio</h3>
                <p className="text-gray-900">{person.bio}</p>
              </div>
            )}

            {/* Email */}
            {person.email && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Email</h3>
                <a
                  href={`mailto:${person.email}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-blue-600 hover:underline"
                >
                  {person.email}
                </a>
              </div>
            )}

            {/* Location */}
            {person.location && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Location</h3>
                <p className="text-gray-900">{person.location}</p>
              </div>
            )}

            {/* LinkedIn */}
            {person.linkedin_url && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">LinkedIn</h3>
                <a
                  href={person.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {person.linkedin_url}
                </a>
              </div>
            )}

            {/* Organizations */}
            {person.company_associations.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Organizations</h3>
                <div className="space-y-2">
                  {person.company_associations.map((assoc, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{assoc.company?.name || 'Unknown'}</p>
                        {assoc.title && (
                          <p className="text-sm text-gray-500">{assoc.title}</p>
                        )}
                      </div>
                      {assoc.relationship_type && (
                        <span className="text-xs text-gray-500 capitalize">
                          {assoc.relationship_type.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-100 flex justify-between">
            <button
              onClick={() => router.push(`/people/${person.id}`)}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              View Full Profile
            </button>
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
