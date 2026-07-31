'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    if (process.env.NODE_ENV !== 'production') return

    let active = true

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        })

        if (!active) return

        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' })
        }
      } catch (error) {
        Sentry.captureException(error, { extra: { route: 'components/service-worker-register' } })
        // The app should still work even if service worker registration fails.
      }
    }

    register()

    return () => {
      active = false
    }
  }, [])

  return null
}
