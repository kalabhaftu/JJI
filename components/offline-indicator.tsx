'use client'

import { useEffect, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { WifiOff01Icon } from '@hugeicons/core-free-icons'

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {

    if (typeof navigator !== 'undefined') {
      setIsOffline(!navigator.onLine)
    }

    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (!isOffline) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm font-medium text-warning shadow-lg animate-in fade-in slide-in-from-bottom-4"
    >
      <HugeiconsIcon icon={WifiOff01Icon} className="w-4 h-4" strokeWidth={1.5} color="currentColor" />
      <span>Offline, showing the last loaded view</span>
      <button
        type="button"
        className="rounded-md border border-warning/40 px-2 py-0.5 text-xs font-semibold text-warning hover:bg-warning/10"
        onClick={() => {
          if (navigator.onLine) {
            window.location.reload()
          }
        }}
      >
        Retry
      </button>
    </div>
  )
}
