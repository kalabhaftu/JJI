import { useEffect, useState } from 'react'
import { useDatabaseRealtime } from '@/lib/realtime/database-realtime'
import type { RealtimeStatus } from '@/lib/realtime/types'
import { useUserStore } from '@/store/user-store'

interface RealtimeAccountsOptions {
  enabled?: boolean
  onUpdate?: () => void
}

interface RealtimeAccountsResult {
  isConnected: boolean
  lastUpdate: Date | null
  connectionStatus: RealtimeStatus
}

export function useRealtimeAccounts(options: RealtimeAccountsOptions = {}): RealtimeAccountsResult {
  const { enabled = true, onUpdate } = options
  const user = useUserStore(state => state.user)

  const [isConnected, setIsConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<RealtimeStatus>('disconnected')

  useEffect(() => {
    if (!enabled) {
      setConnectionStatus('disconnected')
      setIsConnected(false)
      return
    }

    setConnectionStatus('connecting')
  }, [enabled])

  useDatabaseRealtime({
    userId: user?.id,
    enabled: enabled && !!user?.id,
    onAccountChange: () => {
      setLastUpdate(new Date())
      onUpdate?.()
    },
    onTradeChange: () => {
      setLastUpdate(new Date())
      onUpdate?.()
    },
    onStatusChange: (status) => {
      setIsConnected(status === 'connected')
      setConnectionStatus(status)
    }
  })

  return {
    isConnected,
    lastUpdate,
    connectionStatus
  }
}
