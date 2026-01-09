'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SearchModal from './SearchModal'

interface FounderNavigationProps {
  userName?: string
}

export default function FounderNavigation({ userName }: FounderNavigationProps) {
  const [showSearch, setShowSearch] = useState(false)
  const [personId, setPersonId] = useState<string | null>(null)
  const pathname = usePathname()
  const supabase = createClient()

  // Fetch the current user's person ID for profile link
  useEffect(() => {
    async function fetchPersonId() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: person } = await supabase
          .from('saif_people')
          .select('id')
          .eq('auth_user_id', user.id)
          .single()
        if (person) {
          setPersonId(person.id)
        }
      }
    }
    fetchPersonId()
  }, [supabase])

  // Cmd+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearch(true)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const navItems = [
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'Companies', href: '/companies' },
    { name: 'People', href: '/people' },
  ]

  return (
    <>
      <nav className="border-b border-gray-200 sticky top-0 z-40 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <Link href="/dashboard" className="text-xl font-bold text-gray-900">
                SAIFface
              </Link>
              {navItems.map((item) => {
                const isActive = pathname === item.href ||
                  (item.href !== '/dashboard' && pathname?.startsWith(item.href))
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`text-sm ${
                      isActive
                        ? 'font-medium text-gray-900'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {item.name}
                  </Link>
                )
              })}
            </div>
            <div className="flex items-center space-x-4">
              {/* Search Button */}
              <button
                onClick={() => setShowSearch(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg
                  className="w-4 h-4"
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
                <span className="hidden sm:inline">Search</span>
                <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-xs text-gray-400 bg-gray-100 border border-gray-200 rounded">
                  ⌘K
                </kbd>
              </button>
              <div className="w-px h-6 bg-gray-200 hidden sm:block" />
              <Link
                href={personId ? `/people/${personId}` : '/dashboard'}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Profile
              </Link>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      </nav>

      {/* Search Modal */}
      {showSearch && <SearchModal onClose={() => setShowSearch(false)} />}
    </>
  )
}
