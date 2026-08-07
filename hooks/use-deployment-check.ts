'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { apiStreamRequest } from '@/lib/api/stream-client'

interface DeploymentCheckConfig {
  checkInterval?: number
  enabled?: boolean
  onNewDeployment?: () => void
  autoRefresh?: boolean
  autoRefreshDelay?: number
}


export function useDeploymentCheck({
  checkInterval = 5 * 60 * 1000,
  enabled = true,
  onNewDeployment,
  autoRefresh = false,
  autoRefreshDelay = 3000
}: DeploymentCheckConfig = {}) {
  const [buildId, setBuildId] = useState<string | null>(() => process.env.NEXT_PUBLIC_BUILD_ID || null)
  const [isNewDeployment, setIsNewDeployment] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const toastShownRef = useRef(false)

  const checkForNewDeployment = useCallback(async () => {
    if (document.visibilityState === 'hidden') return
    if (toastShownRef.current) return

    try {

      const response = await apiStreamRequest('/api/build-id?' + Date.now(), {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
        operation: 'check-deployment-build',
      })

      const data = await response.json()
      const newBuildId = data.buildId

      if (!buildId) {
        setBuildId(newBuildId)
        return
      }

      if (newBuildId !== buildId) {
        setIsNewDeployment(true)

        if (!toastShownRef.current) {
          toastShownRef.current = true
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }

          if (autoRefresh) {
            toast.info('New version available. Refreshing in 3 seconds...', {
              duration: autoRefreshDelay,
              action: {
                label: 'Refresh Now',
                onClick: () => window.location.reload(),
              },
            })

            setTimeout(() => {
              window.location.reload()
            }, autoRefreshDelay)
          } else {
            toast.info('A new version is available', {
              duration: Infinity,
              action: {
                label: 'Refresh',
                onClick: () => window.location.reload(),
              },
            })
          }

          onNewDeployment?.()
        }
      }
    } catch (error) {

    }
  }, [buildId, onNewDeployment, autoRefresh, autoRefreshDelay])

  useEffect(() => {
    if (!enabled) {
      return
    }

    checkForNewDeployment()

    intervalRef.current = setInterval(checkForNewDeployment, checkInterval)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForNewDeployment()
      }
    }
    const handleFocus = () => {
      checkForNewDeployment()
    }
    const handleOnline = () => {
      checkForNewDeployment()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('online', handleOnline)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('online', handleOnline)
    }
  }, [enabled, checkInterval, checkForNewDeployment])

  const manualCheck = useCallback(() => {
    checkForNewDeployment()
  }, [checkForNewDeployment])

  return {
    isNewDeployment,
    checkForNewDeployment: manualCheck,
    currentBuildId: buildId,
  }
}

