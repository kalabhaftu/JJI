'use client'

import { useEffect } from 'react'
import { useDeploymentCheck } from '@/hooks/use-deployment-check'
import { setupGlobalServerActionErrorHandler } from '@/lib/utils/server-action-error-handler'

interface DeploymentMonitorProps {


  checkInterval?: number
  

  autoRefresh?: boolean
  

  autoRefreshDelay?: number


  enabled?: boolean
}


export function DeploymentMonitor({
  checkInterval = 5 * 60 * 1000,
  autoRefresh = false,
  autoRefreshDelay = 3000,
  enabled = process.env.NODE_ENV === 'production',
}: DeploymentMonitorProps = {}) {
  useDeploymentCheck({
    checkInterval,
    enabled,
    autoRefresh,
    autoRefreshDelay,
    onNewDeployment: () => {},
  })


  useEffect(() => {
    if (enabled) {
      setupGlobalServerActionErrorHandler()
    }
  }, [enabled])

  return null
}

