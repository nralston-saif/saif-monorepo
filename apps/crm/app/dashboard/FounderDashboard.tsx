'use client'

import Link from 'next/link'
import FounderNavigation from '@/components/FounderNavigation'
import PeopleGrid from '@/app/people/PeopleGrid'
import type { Database } from '@/lib/types/database'

type Person = Database['public']['Tables']['saif_people']['Row']

interface Company {
  id: string
  name: string
  short_description: string | null
  logo_url: string | null
  website: string | null
  industry: string | null
  city: string | null
  country: string | null
}

interface Founder {
  id: string
  first_name: string | null
  last_name: string | null
  title: string | null
}

type PersonWithCompanies = Person & {
  companies?: Array<{
    id: string
    relationship_type: string | null
    title: string | null
    is_primary_contact: boolean | null
    end_date: string | null
    company: {
      id: string
      name: string
      logo_url: string | null
      stage: string | null
    } | null
  }>
}

type AINewsArticle = {
  id: string
  title: string
  url: string
  source_name: string | null
  topic: string
  is_ai_safety: boolean
  published_at: string
  fetch_date: string
}

interface FounderDashboardProps {
  person: Person
  userEmail: string
  company: Company | null
  founders: Founder[]
  founderTitle?: string | null
  community: PersonWithCompanies[]
  newsArticles?: AINewsArticle[]
}

const getTopicLabel = (topic: string): string => {
  const labels: Record<string, string> = {
    llm: 'LLM',
    robotics: 'Robotics',
    regulation: 'Policy',
    business: 'Business',
    research: 'Research',
    healthcare: 'Healthcare',
    ai_safety: 'Safety',
    general: 'General',
  }
  return labels[topic] || topic
}

export default function FounderDashboard({ person, userEmail, company, founders, founderTitle, community, newsArticles = [] }: FounderDashboardProps) {
  return (
    <div className="min-h-screen bg-white">
      <FounderNavigation />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section with Avatar */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            {/* Avatar */}
            <div className="flex-shrink-0">
              {person.avatar_url ? (
                <img
                  src={person.avatar_url}
                  alt={`${person.first_name} ${person.last_name}`}
                  className="h-20 w-20 rounded-full object-cover border-2 border-gray-200"
                />
              ) : (
                <div className="h-20 w-20 rounded-full bg-gray-200 flex items-center justify-center border-2 border-gray-200">
                  <span className="text-2xl font-semibold text-gray-500">
                    {person.first_name?.[0] || '?'}
                  </span>
                </div>
              )}
            </div>

            {/* Welcome Text */}
            <div>
              <h2 className="text-3xl font-bold text-gray-900">
                Welcome back{person.first_name ? `, ${person.first_name}` : ''}
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                {founderTitle || (person.role.charAt(0).toUpperCase() + person.role.slice(1))}
                {company && <> at <Link href={`/companies/${company.id}`} className="font-medium text-gray-900 hover:underline">{company.name}</Link></>}
              </p>
            </div>
          </div>

          {/* Schedule Office Hours */}
          <a
            href="https://calendly.com/geoffralston/saif-hours"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 transition"
          >
            Schedule Office Hours
          </a>
        </div>

        {/* AI News Section - Condensed */}
        {newsArticles.length > 0 && (
          <div className="mb-6 bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
              <span className="text-blue-600 text-sm">📰</span>
              <h3 className="text-sm font-medium text-gray-900">AI News</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {newsArticles.map((article) => (
                <a
                  key={article.id}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-4 py-2 hover:bg-gray-50 transition-colors"
                >
                  <p className="text-sm text-gray-900 line-clamp-1">{article.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-500">{article.source_name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      article.is_ai_safety
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {article.is_ai_safety ? 'Safety' : getTopicLabel(article.topic)}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Profile Completion Prompt */}
        {(!person.bio || !person.avatar_url) && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold text-blue-900">Complete your profile</h3>
            <p className="mt-2 text-sm text-blue-700">
              {!person.bio && !person.avatar_url
                ? 'Add your photo and bio to help others in the SAIF community get to know you.'
                : !person.bio
                ? 'Add a bio to help others in the SAIF community get to know you.'
                : 'Add your photo to complete your profile.'
              }
            </p>
            <Link
              href={`/people/${person.id}`}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Complete Profile
            </Link>
          </div>
        )}

        {/* Community Members */}
        <div className="mt-8">
          <PeopleGrid people={community as Person[]} isPartner={false} />
        </div>

      </main>
    </div>
  )
}
