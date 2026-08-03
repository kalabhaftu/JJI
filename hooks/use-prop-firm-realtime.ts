import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { fetchWithError, handleFetchError } from '@/lib/utils/fetch-with-error'
import { API_TIMEOUT } from '@/lib/constants'
import { useDatabaseRealtime } from '@/lib/realtime/database-realtime'
import { useUserStore } from '@/store/user-store'
import { isDemoSurface } from '@/lib/public-surface-routing'
import { reportClientError } from '@/lib/observability/report-error'

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
  const isDemo = typeof window !== 'undefined' && isDemoSurface(window.location.hostname, window.location.pathname)
  const user = useUserStore(state => state.user)

  const [account, setAccount] = useState<PropFirmAccountLocal | null>(null)
  const [drawdown, setDrawdown] = useState<DrawdownData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isFetching, setIsFetching] = useState(false)
  const [isConnected, setIsConnected] = useState(false)

  const previousAccountRef = useRef<PropFirmAccountLocal | null>(null)
  const previousDrawdownRef = useRef<DrawdownData | null>(null)
  const isFetchingRef = useRef(false)
  const hasFetchedRef = useRef(false)

  const fetchAccountData = useCallback(async (showLoadingState = true) => {

    if (!accountId || !enabled || isFetchingRef.current) return

    try {
      isFetchingRef.current = true
      setIsFetching(true)
      if (showLoadingState) {
        setIsLoading(true)
      }
      setError(null)

      const result = await fetchWithError<{ success: boolean; data: any }>(
        `/api/v1/prop-firm/accounts/${accountId}`,
        { timeout: API_TIMEOUT }
      )

      if (!result.ok || !result.data?.success) {
        throw new Error(result.error?.message || 'Failed to fetch account data')
      }

      const { account: accountData, drawdown: drawdownData } = result.data.data

      if (!accountData || !drawdownData) {
        throw new Error('Invalid response format: missing account or drawdown data')
      }

      if (previousAccountRef.current && previousAccountRef.current.status !== accountData.status) {
        if (accountData.status === 'failed') {
          toast.error("Account Failed", {
            description: `Account ${accountData.accountName || accountData.number} has been marked as failed.`,
          })
        } else if (accountData.status === 'funded') {
          toast.success("Account Funded!", {
            description: `Congratulations! Account ${accountData.accountName || accountData.number} has been funded.`,
          })
        }
      }

      if (drawdownData?.isBreached && (!previousDrawdownRef.current?.isBreached)) {
        toast.error("Drawdown Breach Alert!", {
          description: `Account ${accountData.accountName || accountData.number} has breached ${drawdownData.breachType?.replace('_', ' ')} limits.`,
        })
      }

      previousAccountRef.current = accountData
      previousDrawdownRef.current = drawdownData

      setAccount(accountData)
      setDrawdown(drawdownData)
      setLastUpdated(new Date())

    } catch (err) {
      reportClientError(err, { operation: 'load-prop-firm-realtime-account', route: '/api/v1/prop-firm/accounts' })
      setError(handleFetchError(err))
    } finally {
      isFetchingRef.current = false
      setIsFetching(false)
      if (showLoadingState) {
        setIsLoading(false)
      }
    }
  }, [accountId, enabled])

  const refetch = useCallback(async () => {
    await fetchAccountData(true)
  }, [fetchAccountData])

  useDatabaseRealtime({
    userId: user?.id,
    enabled: enabled && !!accountId && !!user?.id,
    onAccountChange: (change) => {
      if (!accountId) return

      if (change.table === 'MasterAccount') {
        const changedAccountId = (change.newRecord?.id || change.oldRecord?.id) as string | undefined
        if (changedAccountId === accountId) {
          fetchAccountData(false)
        }
      }

      else if (change.table === 'PhaseAccount') {
        const phaseMasterAccountId = (change.newRecord?.masterAccountId || change.oldRecord?.masterAccountId) as string | undefined
        if (phaseMasterAccountId === accountId) {
          fetchAccountData(false)
        }
      }

    },
    onTradeChange: (change) => {
      if (!accountId || !account) return

      const tradePhaseAccountId = (change.newRecord?.phaseAccountId || change.oldRecord?.phaseAccountId) as string | undefined
      if (tradePhaseAccountId) {
        const accountPhaseIds = account.phases.map(p => p.id)
        if (accountPhaseIds.includes(tradePhaseAccountId)) {
          fetchAccountData(false)
        }
      }
    },
    onStatusChange: (status) => {
      setIsConnected(status === 'connected')
    }
  })

  const prevAccountIdRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (!enabled || !accountId) return

    if (prevAccountIdRef.current !== accountId) {
      hasFetchedRef.current = false
      prevAccountIdRef.current = accountId
    }

    if (hasFetchedRef.current) return
    hasFetchedRef.current = true

    fetchAccountData(true)
  }, [enabled, accountId, fetchAccountData])

  return {
    account,
    drawdown,
    isLoading,
    error,
    lastUpdated,
    refetch,
    isConnected
  }
}
