'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface ImpersonationState {
  id: string
  name: string
}

export default function ImpersonationBanner() {
  const [impersonating, setImpersonating] = useState<ImpersonationState | null>(null)
  const [stopping, setStopping] = useState(false)
  const router = useRouter()

  useEffect(() => {
    async function checkImpersonation() {
      try {
        const response = await fetch('/api/auth/impersonate')
        const data = await response.json()
        setImpersonating(data.impersonating)
      } catch (error) {
        console.error('Error checking impersonation:', error)
      }
    }

    checkImpersonation()
  }, [])

  const handleStopImpersonating = async () => {
    setStopping(true)
    try {
      await fetch('/api/auth/impersonate', { method: 'DELETE' })
      setImpersonating(null)
      router.push('/dashboard')
      router.refresh()
    } catch (error) {
      console.error('Error stopping impersonation:', error)
    } finally {
      setStopping(false)
    }
  }

  if (!impersonating) {
    return null
  }

  return (
    <div className="bg-amber-500 text-white px-4 py-2 text-center text-sm font-medium sticky top-0 z-50">
      <span>
        Viewing as <strong>{impersonating.name}</strong>
      </span>
      <button
        onClick={handleStopImpersonating}
        disabled={stopping}
        className="ml-4 px-3 py-1 bg-white text-amber-600 rounded text-xs font-semibold hover:bg-amber-50 disabled:opacity-50"
      >
        {stopping ? 'Stopping...' : 'Stop Impersonating'}
      </button>
    </div>
  )
}
