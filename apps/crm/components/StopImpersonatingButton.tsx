'use client'

import { useState } from 'react'

export default function StopImpersonatingButton() {
  const [stopping, setStopping] = useState(false)

  const handleStop = async () => {
    setStopping(true)
    try {
      await fetch('/api/auth/impersonate', { method: 'DELETE' })
      // Full page reload to ensure layout (ImpersonationBanner) re-renders
      window.location.href = '/dashboard'
    } catch (error) {
      console.error('Error stopping impersonation:', error)
    } finally {
      setStopping(false)
    }
  }

  return (
    <button
      onClick={handleStop}
      disabled={stopping}
      className="ml-4 px-3 py-1 bg-white text-amber-600 rounded text-xs font-semibold hover:bg-amber-50 disabled:opacity-50"
    >
      {stopping ? 'Stopping...' : 'Stop Impersonating'}
    </button>
  )
}
