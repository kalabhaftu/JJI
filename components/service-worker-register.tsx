'use client'

import { useEffect } from 'react'
import { reportError } from '@/lib/observability/report-error'
import { isDemoHost, isDocsHost } from '@/lib/public-surface-routing'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    if (process.env.NODE_ENV !== 'production') return
    const { hostname, pathname } = window.location
    if (
      isDocsHost(hostname)
      || isDemoHost(hostname)
      || pathname === '/docs'
      || pathname.startsWith('/docs/')
      || pathname === '/demo'
      || pathname.startsWith('/demo/')
    ) return

    let active = true

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        })

        if (!active) return

        const waitingWorker = registration.waiting
        if (waitingWorker) {
          waitingWorker.postMessage({ type: 'SKIP_WAITING' })
        }
      } catch (error) {
        reportError(error, {
          surface: 'client',
          operation: 'register-service-worker',
          route: '/sw.js',


          expected: true,
        })

      }
    }

    register()

    return () => {
      active = false
    }
  }, [])

  return null
}
