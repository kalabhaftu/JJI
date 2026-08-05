'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiRequestData } from '@/lib/api/client'
import { useDatabaseRealtime } from '@/lib/realtime/database-realtime'
import { useUserStore } from '@/store/user-store'
import { queryKeys } from '@/lib/query/query-keys'
import { useQueryScope, isScopeReady } from '@/lib/query/use-query-scope'

interface PropFirmAccountLocal {
  id: string
  accountName: string
  propFirmName: string
  accountSize: number
  evaluationType: string
  currentPhase: {
    id: string
    phaseNumber: number
    phaseId: string | null
    status: 'active' | 'passed' | 'failed' | 'archived'
    profitTargetPercent: number
    dailyDrawdownPercent: number
    maxDrawdownPercent: number
    maxDrawdownType: string
    minTradingDays: number
    timeLimitDays: number | null
    consistencyRulePercent: number
    profitSplitPercent: number | null
    payoutCycleDays: number | null
    startDate: string
    endDate: string | null
  } | null
  status: 'active' | 'funded' | 'failed'
  phases: Array<{
    id: string
    phaseNumber: number
    phaseId: string | null
    status: 'active' | 'pending' | 'passed' | 'failed' | 'archived'
    profitTargetPercent: number
    dailyDrawdownPercent: number
    maxDrawdownPercent: number
    maxDrawdownType: string
    minTradingDays: number
    timeLimitDays: number | null
    consistencyRulePercent: number
    profitSplitPercent: number | null
    payoutCycleDays: number | null
    startDate: string
    endDate: string | null
    tradeCount?: number
    totalPnL?: number
    wins?: number
    losses?: number
    breakEvenTrades?: number
    winRate?: number
    profitProgress?: number
  }>
  currentPnL?: number
  currentGrossPnL?: number
  currentNetPnL?: number
  currentBalance?: number
  currentEquity?: number
  dailyDrawdownRemaining?: number
  maxDrawdownRemaining?: number
  profitTargetProgress?: number
  lastUpdated: string
}

interface DrawdownData {
  dailyDrawdownRemaining: number
  maxDrawdownRemaining: number
  dailyStartBalance: number
  highestEquity: number
  currentEquity: number
  isBreached: boolean
  breachType?: 'daily_drawdown' | 'max_drawdown'
}

interface UsePropFirmRealtimeOptions {
  accountId?: string
  enabled?: boolean
}

interface UsePropFirmRealtimeResult {
  account: PropFirmAccountLocal | null
  drawdown: DrawdownData | null
  isLoading: boolean
  error: string | null
  lastUpdated: Date | null
  refetch: () => Promise<void>
  isConnected: boolean
}

export function usePropFirmRealtime(options: UsePropFirmRealtimeOptions): UsePropFirmRealtimeResult {
  const { accountId, enabled = true } = options
  const scope = useQueryScope()
  const user = useUserStore(state => state.user)

  const query = useQuery({
    queryKey: queryKeys.propFirmAccount(scope, accountId || ''),
    queryFn: async ({ signal }) => {
      const data = await apiRequestData<{ account?: PropFirmAccountLocal; drawdown?: DrawdownData }>(
        `/api/v1/prop-firm/accounts/${accountId}`,
        { signal, operation: 'load-prop-firm-account' },
      )
      if (!data?.account || !data?.drawdown) {
        throw new Error('Invalid response format: missing account or drawdown data')
      }
      return data as { account: PropFirmAccountLocal; drawdown: DrawdownData }
    },
    enabled: enabled && isScopeReady(scope) && Boolean(accountId),
    staleTime: 30_000,
  })

  const account = query.data?.account ?? null
  const drawdown = query.data?.drawdown ?? null

  const previousAccountRef = useRef<PropFirmAccountLocal | null>(null)
  const previousDrawdownRef = useRef<DrawdownData | null>(null)

  useEffect(() => {
    previousAccountRef.current = null
    previousDrawdownRef.current = null
  }, [accountId])

  useEffect(() => {
    if (!account) return

    if (previousAccountRef.current && previousAccountRef.current.status !== account.status) {
      if (account.status === 'failed') {
        toast.error('Account Failed', {
          description: `Account ${account.accountName || account.id} has been marked as failed.`,
        })
      } else if (account.status === 'funded') {
        toast.success('Account Funded!', {
          description: `Congratulations! Account ${account.accountName || account.id} has been funded.`,
        })
      }
    }

    if (drawdown?.isBreached && !previousDrawdownRef.current?.isBreached) {
      toast.error('Drawdown Breach Alert!', {
        description: `Account ${account.accountName || account.id} has breached ${drawdown.breachType?.replace('_', ' ')} limits.`,
      })
    }

    previousAccountRef.current = account
    previousDrawdownRef.current = drawdown
  }, [account, drawdown])

  const [isConnected, setIsConnected] = useState(false)

  useDatabaseRealtime({
    userId: user?.id,
    enabled: enabled && !!accountId && !!user?.id,
    onStatusChange: (status) => {
      setIsConnected(status === 'connected')
    },
  })

  return {
    account,
    drawdown,
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    lastUpdated: query.dataUpdatedAt ? new Date(query.dataUpdatedAt) : null,
    refetch: async () => {
      await query.refetch()
    },
    isConnected,
  }
}
