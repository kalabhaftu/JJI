'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react'
import { useData } from '@/context/data-provider'
import { toast } from 'sonner'
import { reportError } from '@/lib/observability/report-error'
import { type SynchronizationType } from '@/lib/db/schema'
import { DEFAULT_INCLUDED_FEE_TYPES } from '@/app/dashboard/components/import/tradovate/sync/fee-types'
import { useUserStore } from '@/store/user-store'
import { useDatabaseRealtime } from '@/lib/realtime/database-realtime'
import logger from '@/lib/logger'

interface TradovateSyncContextType {

  performSyncForAccount: (accountId: string) => Promise<{ success: boolean; message: string } | undefined>
  performSyncForAllAccounts: () => Promise<void>

  isAutoSyncing: boolean

  accounts: SynchronizationType[]
  loadAccounts: () => Promise<void>
  deleteAccount: (accountId: string) => Promise<void>

  getIncludedFeeTypesForAccount: (accountId: string) => Record<string, boolean>
  updateIncludedFeeTypesForAccount: (accountId: string, includedFeeTypes: Record<string, boolean>) => Promise<{ success: boolean; error?: string }>

  syncInterval: number
  setSyncInterval: (interval: number) => void
  enableAutoSync: boolean
  setEnableAutoSync: (enabled: boolean) => void
}

const TradovateSyncContext = createContext<TradovateSyncContextType | undefined>(undefined)

export function TradovateSyncContextProvider({ children, disabled = false }: { children: ReactNode; disabled?: boolean }) {
  const [isAutoSyncing, setIsAutoSyncing] = useState(false)
  const [accounts, setAccounts] = useState<SynchronizationType[]>([])
  const [syncInterval, setSyncInterval] = useState(15)
  const [enableAutoSync, setEnableAutoSync] = useState(false)

  const user = useUserStore((state) => state.user)
  const nextSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const checkAndPerformSyncsRef = useRef<() => void>(() => {})

  const getIncludedFeeTypesForAccount = useCallback((accountId: string) => {
    const account = accounts.find((a) => a.accountId === accountId)
    const raw = (account as any)?.includedFeeTypes
    if (raw && typeof raw === 'object') {
      return { ...DEFAULT_INCLUDED_FEE_TYPES, ...raw } as Record<string, boolean>
    }
    return { ...DEFAULT_INCLUDED_FEE_TYPES }
  }, [accounts])

  const { refreshTrades } = useData()

  const normalizeSynchronization = useCallback(
    (sync: any): SynchronizationType => ({
      ...sync,
      lastSyncedAt: sync?.lastSyncedAt ? new Date(sync.lastSyncedAt) : null,
      tokenExpiresAt: sync?.tokenExpiresAt ? new Date(sync.tokenExpiresAt) : null,
      dailySyncTime: sync?.dailySyncTime ? new Date(sync.dailySyncTime) : null,
      createdAt: sync?.createdAt ? new Date(sync.createdAt) : new Date(),
      updatedAt: sync?.updatedAt ? new Date(sync.updatedAt) : new Date(),
      includedFeeTypes: sync?.includedFeeTypes ?? null,
    }),
    []
  )

  const loadAccounts = useCallback(async () => {
    if (disabled) {
      setAccounts([])
      return
    }

    try {
      const response = await fetch("/api/v1/tradovate/synchronizations", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch Tradovate synchronizations")
      }

      const result = await response.json()
      const data = Array.isArray(result.data) ? result.data : []
      setAccounts(data.map(normalizeSynchronization))
    } catch (error) {
      reportError(error, { surface: 'client', operation: 'load-tradovate-accounts', route: '/api/v1/tradovate/accounts' })
    }
  }, [disabled, normalizeSynchronization])

  const updateIncludedFeeTypesForAccount = useCallback(
    async (accountId: string, includedFeeTypes: Record<string, boolean>) => {
      if (disabled) {
        return { success: false, error: 'Tradovate sync is disabled in demo mode' }
      }

      const res = await fetch('/api/v1/tradovate/synchronizations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, includedFeeTypes }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        return { success: false, error: data.error?.message || data.message || 'Failed to update' }
      }
      await loadAccounts()
      return { success: true }
    },
    [disabled, loadAccounts]
  )

  const deleteAccount = useCallback(async (accountId: string) => {
    setAccounts(prev => prev.filter(acc => acc.accountId !== accountId))
    if (disabled) return
    await fetch("/api/v1/tradovate/synchronizations", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId })
    })
  }, [disabled])

  const performSyncForAccount = useCallback(async (accountId: string) => {
    if (disabled) {
      return { success: false, message: 'Tradovate sync is disabled in demo mode' }
    }

    const account = accounts.find(acc => acc.accountId === accountId)
    if (!account) {
      const errorMsg = `Account ${accountId} not found`
      return { success: false, message: errorMsg }
    }

    if (!account.token) {
      const errorMsg = `Token for account ${accountId} is expired`
      return { success: false, message: errorMsg }
    }

    try {
      const runSync = async () => {
        logger.debug({ accountId }, 'Starting Tradovate sync')
        if (!account.token) {
          const errorMsg = `Token for account ${accountId} is expired`
          return errorMsg
        }

        const response = await fetch("/api/v1/tradovate/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId })
        })

        const payload = await response.json()

        const responseMessage = payload?.error?.message ?? payload?.message
        if (responseMessage === "DUPLICATE_TRADES") {
          return "All trades from this account have already been imported"
        }

        if (!response.ok || !payload?.success) {
          const errorMsg = responseMessage || `Sync error for account ${accountId}`
          throw new Error(errorMsg)
        }

        const savedCount = payload.savedCount || 0
        const ordersCount = payload.ordersCount || 0

        logger.debug({ accountId, savedCount, ordersCount }, 'Tradovate sync complete')

        let successMessage: string
        if (savedCount > 0) {
          successMessage = `Sync complete: ${savedCount} trades saved, ${ordersCount} orders processed for account ${accountId}.`
        } else if (ordersCount > 0) {
          successMessage = `Sync complete: No new trades found. ${ordersCount} orders processed for account ${accountId}.`
        } else {
          successMessage = `Sync complete: No orders found for account ${accountId}.`
        }

        await loadAccounts()
        await refreshTrades()

        return successMessage
      }

      const promise = runSync()
      toast.promise(promise, {
        loading: `Syncing Tradovate account ${accountId}...`,
        success: (msg: string) => msg,
        error: (e) => `Sync failed: ${e instanceof Error ? e.message : "Unknown error"}`
      })
      const message: string = await promise
      return { success: true, message: message }

    } catch (error) {
      const errorMsg = `Sync error for account ${accountId}: ${error instanceof Error ? error.message : "Unknown error"}`
      reportError(error, {
        surface: 'client',
        operation: 'sync-tradovate-account',
        entityId: accountId,
      })
      return { success: false, message: errorMsg }
    }
  }, [accounts, disabled, refreshTrades, loadAccounts])

  const performSyncForAllAccounts = useCallback(async () => {
    if (disabled) return
    if (isAutoSyncing) {
      return
    }

    setIsAutoSyncing(true)

    try {
      const validAccounts = accounts.filter(acc => acc.token)
      if (validAccounts.length === 0) {
        return
      }

      for (const account of validAccounts) {
        await performSyncForAccount(account.accountId)

        await new Promise(resolve => setTimeout(resolve, 1000))
      }

    } catch (error) {
      reportError(error, {
        surface: 'client',
        operation: 'sync-all-tradovate-accounts',
      })
    } finally {
      setIsAutoSyncing(false)
    }
  }, [disabled, isAutoSyncing, accounts, performSyncForAccount])

  const clearNextSyncTimer = useCallback(() => {
    if (nextSyncTimerRef.current) {
      clearTimeout(nextSyncTimerRef.current)
      nextSyncTimerRef.current = null
    }
  }, [])

  const scheduleNextSync = useCallback(() => {
    clearNextSyncTimer()
    if (!enableAutoSync) return

    const dueAt = accounts
      .filter((account) => account.lastSyncedAt)
      .map((account) => new Date(account.lastSyncedAt).getTime() + syncInterval * 60 * 1000)

    if (dueAt.length === 0) return

    const delay = Math.max(0, Math.min(...dueAt) - Date.now())
    nextSyncTimerRef.current = setTimeout(() => {
      void checkAndPerformSyncsRef.current()
    }, Math.min(delay, 2_147_000_000))
  }, [accounts, enableAutoSync, syncInterval, clearNextSyncTimer])

  const checkAndPerformSyncs = useCallback(async () => {
    if (disabled) return
    if (document.visibilityState === 'hidden') return
    if (!enableAutoSync || isAutoSyncing) return

    try {
      const now = Date.now()

      for (const account of accounts) {

        if (!account.token) continue

        const lastSyncTime = new Date(account.lastSyncedAt).getTime()
        const minutesSinceLastSync = (now - lastSyncTime) / (1000 * 60)

        if (minutesSinceLastSync >= syncInterval) {
          logger.debug({ accountId: account.accountId }, 'Tradovate auto-sync triggered')
          await performSyncForAccount(account.accountId)
        }
      }
    } catch (error) {
      reportError(error, { surface: 'client', operation: 'check-tradovate-auto-sync', route: '/dashboard' })
    }

    scheduleNextSync()
  }, [disabled, enableAutoSync, isAutoSyncing, accounts, syncInterval, performSyncForAccount, scheduleNextSync]);

  checkAndPerformSyncsRef.current = checkAndPerformSyncs

  useDatabaseRealtime({
    userId: user?.id,
    enabled: enableAutoSync && !disabled,
    onSynchronizationChange: (change) => {
      if (change.event === 'UPDATE') void checkAndPerformSyncsRef.current()
    },
  })

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void checkAndPerformSyncsRef.current()
    }
    const handleOnline = () => {
      void checkAndPerformSyncsRef.current()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('online', handleOnline)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  useEffect(() => {
    scheduleNextSync()
    return clearNextSyncTimer
  }, [scheduleNextSync, clearNextSyncTimer])

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts])

  return (
    <TradovateSyncContext.Provider value={{

      performSyncForAccount,
      performSyncForAllAccounts,

      isAutoSyncing,

      accounts,
      loadAccounts,
      deleteAccount,

      getIncludedFeeTypesForAccount,
      updateIncludedFeeTypesForAccount,

      syncInterval,
      setSyncInterval,
      enableAutoSync,
      setEnableAutoSync,
    }}>
      {children}
    </TradovateSyncContext.Provider>
  )
}

export function useTradovateSyncContext() {
  const context = useContext(TradovateSyncContext)
  if (context === undefined) {
    throw new Error('useTradovateSyncContext must be used within a TradovateSyncContextProvider')
  }
  return context
}
