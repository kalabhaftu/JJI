'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { toast } from 'sonner'

interface DeploymentCheckConfig {
  checkInterval?: number // in milliseconds, default 5 minutes
  enabled?: boolean
  onNewDeployment?: () => void
  autoRefresh?: boolean
  autoRefreshDelay?: number // in milliseconds
}

export function useDeploymentCheck({
  checkInterval = 5 * 60 * 1000, // 5 minutes default
  enabled = true,
  onNewDeployment,
  autoRefresh = false,
  autoRefreshDelay = 3000
}: DeploymentCheckConfig = {}) {
  const [buildId, setBuildId] = useState<string | null>(null)
  const [isNewDeployment, setIsNewDeployment] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const toastShownRef = useRef(false)

  const checkForNewDeployment = useCallback(async () => {
    try {
      // We'll use a cache-busted request to ensure we get fresh data
      const response = await fetch('/api/build-id?' + Date.now(), {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      })

      if (!response.ok) {
        return
      }

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
      // Silently fail - don't want to spam users with errors
    }
  }, [buildId, onNewDeployment, autoRefresh, autoRefreshDelay])

  useEffect(() => {
    if (!enabled) {
      return
    }

    checkForNewDeployment()

    intervalRef.current = setInterval(checkForNewDeployment, checkInterval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
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

