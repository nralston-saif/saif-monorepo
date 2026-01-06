'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/types/database'

type Company = Database['public']['Tables']['saif_companies']['Row']
type Person = Database['public']['Tables']['saif_people']['Row']
type CompanyPerson = Database['public']['Tables']['saif_company_people']['Row']

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
}

export default function CompanyView({ company, canEdit, isPartner, currentPersonId }: CompanyViewProps) {
  const router = useRouter()
  const supabase = createClient()

  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

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
    short_description: company.short_description || '',
    website: company.website || '',
    industry: company.industry || '',
    founded_year: company.founded_year?.toString() || '',
    city: company.city || '',
    country: company.country || '',
    YC_batch: company.YC_batch || '',
    is_AIsafety_company: company.is_AIsafety_company,
  })

  const [logoUrl, setLogoUrl] = useState(company.logo_url)

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
    } catch (err) {
      console.error('Error uploading logo:', err)
      setError('Failed to upload logo. Please try again.')
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
      const { error: updateError } = await supabase
        .from('saif_companies')
        .update({
          name: formData.name,
          short_description: formData.short_description || null,
          website: formData.website || null,
          industry: formData.industry || null,
          founded_year: formData.founded_year ? parseInt(formData.founded_year) : null,
          city: formData.city || null,
          country: formData.country || null,
          YC_batch: formData.YC_batch || null,
          is_AIsafety_company: formData.is_AIsafety_company,
          updated_at: new Date().toISOString(),
        })
        .eq('id', company.id)

      if (updateError) {
        throw updateError
      }

      setSuccess('Company updated successfully!')
      setIsEditing(false)

      // Refresh the page to show updated data
      setTimeout(() => {
        router.refresh()
      }, 1000)
    } catch (err) {
      console.error('Error updating company:', err)
      setError('Failed to update company. Please try again.')
    } finally {
      setSaving(false)
    }
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
          .select('id')
          .eq('email', newFounder.email)
          .single()

        if (existingPerson) {
          personId = existingPerson.id
        }
      }

      // Create new person if doesn't exist
      if (!personId) {
        const { data: createdPerson, error: createError } = await supabase
          .from('saif_people')
          .insert({
            first_name: newFounder.first_name,
            last_name: newFounder.last_name,
            email: newFounder.email || null,
            role: 'founder',
            status: 'tracked', // Tracked until they sign up
          })
          .select()
          .single()

        if (createError) throw createError
        personId = createdPerson.id
      }

      // Link founder to company
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
    } catch (err) {
      console.error('Error removing founder:', err)
      setError('Failed to remove founder. Please try again.')
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
            <div className="mt-2 flex flex-wrap gap-2">
              {company.industry && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  {company.industry}
                </span>
              )}
              {company.YC_batch && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                  YC {company.YC_batch}
                </span>
              )}
              {company.is_AIsafety_company && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  AI Safety
                </span>
              )}
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                {company.stage}
              </span>
            </div>
          </div>
        </div>

        {/* Edit Button */}
        {canEdit && !isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800"
          >
            Edit Company
          </button>
        )}
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

              <div>
                <label htmlFor="YC_batch" className="block text-sm font-medium text-gray-700">
                  YC Batch
                </label>
                <input
                  type="text"
                  id="YC_batch"
                  name="YC_batch"
                  value={formData.YC_batch}
                  onChange={handleInputChange}
                  placeholder="S24, W25, etc."
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_AIsafety_company"
                  name="is_AIsafety_company"
                  checked={formData.is_AIsafety_company}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-gray-900 focus:ring-gray-900 border-gray-300 rounded"
                />
                <label htmlFor="is_AIsafety_company" className="ml-2 block text-sm text-gray-700">
                  AI Safety Company
                </label>
              </div>
            </div>
          </div>

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
                  short_description: company.short_description || '',
                  website: company.website || '',
                  industry: company.industry || '',
                  founded_year: company.founded_year?.toString() || '',
                  city: company.city || '',
                  country: company.country || '',
                  YC_batch: company.YC_batch || '',
                  is_AIsafety_company: company.is_AIsafety_company,
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
                      href={company.website}
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
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="text-sm font-semibold text-gray-900">
                              {person.first_name} {person.last_name}
                            </h3>
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
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-gray-900">
                          {person.first_name} {person.last_name}
                        </h3>
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
          {otherTeam.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Team</h2>
              <div className="space-y-3">
                {otherTeam.map((member) => {
                  const person = member.person
                  if (!person) return null

                  return (
                    <div key={member.id} className="flex items-center space-x-3">
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
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">
                          {person.first_name} {person.last_name}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {member.title || member.relationship_type}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Investment Info (Partners Only) */}
          {isPartner && company.investments && company.investments.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Investments</h2>
                <p className="text-sm text-gray-500">
                  Total: ${company.investments.reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0).toLocaleString()}
                </p>
              </div>
              <div className="space-y-4">
                {company.investments.map((investment: any) => {
                  // Format terms based on type
                  const getTerms = () => {
                    if (investment.type === 'SAFE' || investment.type === 'safe') {
                      if (investment.post_money_valuation) {
                        return `$${(investment.post_money_valuation / 1000000).toFixed(0)}M cap SAFE`
                      }
                      if (investment.discount) {
                        return `${investment.discount}% discount SAFE`
                      }
                      return 'SAFE'
                    }
                    if (investment.post_money_valuation) {
                      return `$${(investment.post_money_valuation / 1000000).toFixed(1)}M post`
                    }
                    return investment.type || null
                  }

                  const terms = getTerms()

                  return (
                    <div key={investment.id} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {investment.round || 'Investment'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(investment.investment_date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-gray-900">
                            ${investment.amount?.toLocaleString() || '-'}
                          </p>
                          {investment.status && investment.status !== 'active' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                              {investment.status}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Investment Details Grid */}
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {terms && (
                          <div>
                            <span className="text-gray-500">Terms:</span>
                            <span className="ml-2 text-gray-900 font-medium">{terms}</span>
                          </div>
                        )}
                        {investment.type && !terms?.includes(investment.type) && (
                          <div>
                            <span className="text-gray-500">Type:</span>
                            <span className="ml-2 text-gray-900">{investment.type}</span>
                          </div>
                        )}
                        {investment.shares && (
                          <div>
                            <span className="text-gray-500">Shares:</span>
                            <span className="ml-2 text-gray-900">{investment.shares.toLocaleString()}</span>
                          </div>
                        )}
                        {investment.fd_shares && (
                          <div>
                            <span className="text-gray-500">FD Shares:</span>
                            <span className="ml-2 text-gray-900">{investment.fd_shares.toLocaleString()}</span>
                          </div>
                        )}
                      </div>

                      {/* Exit Info */}
                      {investment.exit_date && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-xs text-gray-500">
                            <span className="font-medium text-green-700">Exited:</span>{' '}
                            {new Date(investment.exit_date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                            {investment.acquirer && ` → ${investment.acquirer}`}
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  )
}
