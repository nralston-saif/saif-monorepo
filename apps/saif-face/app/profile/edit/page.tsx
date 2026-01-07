'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/types/database'
import Link from 'next/link'
import { LOGIN_URL } from '@/lib/constants'

type Person = Database['public']['Tables']['saif_people']['Row']

export default function EditProfilePage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [profile, setProfile] = useState<Person | null>(null)
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    title: '',
    bio: '',
    location: '',
    mobile_phone: '',
    linkedin_url: '',
    twitter_url: '',
  })

  // Load profile data
  useEffect(() => {
    async function loadProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          window.location.href = LOGIN_URL
          return
        }

        const { data: profileData, error: profileError } = await supabase
          .from('saif_people')
          .select('*')
          .eq('auth_user_id', user.id)
          .single()

        if (profileError || !profileData) {
          router.push('/profile/claim')
          return
        }

        const typedProfile = profileData as Person
        setProfile(typedProfile)

        // Populate form
        setFormData({
          first_name: typedProfile.first_name || '',
          last_name: typedProfile.last_name || '',
          title: typedProfile.title || '',
          bio: typedProfile.bio || '',
          location: typedProfile.location || '',
          mobile_phone: typedProfile.mobile_phone || '',
          linkedin_url: typedProfile.linkedin_url || '',
          twitter_url: typedProfile.twitter_url || '',
        })

        setLoading(false)
      } catch (err) {
        console.error('Error loading profile:', err)
        setError('Failed to load profile. Please try again.')
        setLoading(false)
      }
    }

    loadProfile()
  }, [router, supabase])

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile) return

    setUploadingAvatar(true)
    setError(null)

    try {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB')
        setUploadingAvatar(false)
        return
      }

      // Check file type
      if (!file.type.startsWith('image/')) {
        setError('File must be an image')
        setUploadingAvatar(false)
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = LOGIN_URL
        return
      }

      // Delete old avatar if exists
      if (profile.avatar_url) {
        // Extract path from URL or use as-is if it's already a path
        const oldPath = profile.avatar_url.includes('/storage/v1/object/public/')
          ? profile.avatar_url.split('/storage/v1/object/public/saif-avatars/')[1]
          : profile.avatar_url

        if (oldPath) {
          await supabase.storage
            .from('saif-avatars')
            .remove([oldPath])
        }
      }

      // Upload new avatar
      const fileExt = file.name.split('.').pop()
      const fileName = `avatar-${Date.now()}.${fileExt}`
      const filePath = `${user.id}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('saif-avatars')
        .upload(filePath, file)

      if (uploadError) {
        throw uploadError
      }

      // Get public URL for display
      const { data: { publicUrl } } = supabase.storage
        .from('saif-avatars')
        .getPublicUrl(filePath)

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('saif_people')
        .update({ avatar_url: publicUrl })
        .eq('id', profile.id)

      if (updateError) {
        throw updateError
      }

      // Force reload the image by adding timestamp
      setProfile({ ...profile, avatar_url: `${publicUrl}?t=${Date.now()}` })
      setSuccess('Avatar uploaded successfully!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error uploading avatar:', err)
      setError('Failed to upload avatar. Please try again.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const { error: updateError } = await supabase
        .from('saif_people')
        .update({
          first_name: formData.first_name || null,
          last_name: formData.last_name || null,
          title: formData.title || null,
          bio: formData.bio || null,
          location: formData.location || null,
          mobile_phone: formData.mobile_phone || null,
          linkedin_url: formData.linkedin_url || null,
          twitter_url: formData.twitter_url || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id)

      if (updateError) {
        throw updateError
      }

      setSuccess('Profile updated successfully!')
      setTimeout(() => {
        router.push('/dashboard')
      }, 1500)
    } catch (err) {
      console.error('Error updating profile:', err)
      setError('Failed to update profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-sm text-gray-600">Loading profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Edit Profile</h1>
          <p className="mt-2 text-sm text-gray-600">
            Update your information and photo
          </p>
        </div>

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

        {/* Avatar Section */}
        <div className="mb-8 bg-gray-50 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile Photo</h2>
          <div className="flex items-center space-x-6">
            <div className="flex-shrink-0">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Profile"
                  className="h-24 w-24 rounded-full object-cover"
                />
              ) : (
                <div className="h-24 w-24 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-2xl text-gray-500">
                    {formData.first_name?.[0] || '?'}
                  </span>
                </div>
              )}
            </div>
            <div className="flex-1">
              <label
                htmlFor="avatar-upload"
                className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                {uploadingAvatar ? 'Uploading...' : 'Upload New Photo'}
              </label>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                disabled={uploadingAvatar}
                className="hidden"
              />
              <p className="mt-2 text-xs text-gray-500">
                JPG, PNG or WebP. Max size 5MB.
              </p>
            </div>
          </div>
        </div>

        {/* Profile Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="first_name" className="block text-sm font-medium text-gray-700">
                    First Name *
                  </label>
                  <input
                    type="text"
                    id="first_name"
                    name="first_name"
                    required
                    value={formData.first_name}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                  />
                </div>
                <div>
                  <label htmlFor="last_name" className="block text-sm font-medium text-gray-700">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    id="last_name"
                    name="last_name"
                    required
                    value={formData.last_name}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                  Title / Role
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="e.g. Co-Founder & CEO"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                />
              </div>

              <div>
                <label htmlFor="bio" className="block text-sm font-medium text-gray-700">
                  Bio
                </label>
                <textarea
                  id="bio"
                  name="bio"
                  rows={4}
                  value={formData.bio}
                  onChange={handleInputChange}
                  placeholder="Tell the SAIF community about yourself..."
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                />
              </div>

              <div>
                <label htmlFor="location" className="block text-sm font-medium text-gray-700">
                  Location
                </label>
                <input
                  type="text"
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  placeholder="e.g. San Francisco, CA"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="mobile_phone" className="block text-sm font-medium text-gray-700">
                  Mobile Phone
                </label>
                <input
                  type="tel"
                  id="mobile_phone"
                  name="mobile_phone"
                  value={formData.mobile_phone}
                  onChange={handleInputChange}
                  placeholder="+1 (555) 123-4567"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                />
              </div>

              <div>
                <label htmlFor="linkedin_url" className="block text-sm font-medium text-gray-700">
                  LinkedIn URL
                </label>
                <input
                  type="url"
                  id="linkedin_url"
                  name="linkedin_url"
                  value={formData.linkedin_url}
                  onChange={handleInputChange}
                  placeholder="https://linkedin.com/in/yourname"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                />
              </div>

              <div>
                <label htmlFor="twitter_url" className="block text-sm font-medium text-gray-700">
                  Twitter / X URL
                </label>
                <input
                  type="url"
                  id="twitter_url"
                  name="twitter_url"
                  value={formData.twitter_url}
                  onChange={handleInputChange}
                  placeholder="https://twitter.com/yourhandle"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-between">
            <Link
              href="/dashboard"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
