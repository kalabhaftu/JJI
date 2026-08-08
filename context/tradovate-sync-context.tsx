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
import { apiRequestData } from '@/lib/api/client'
import { ApiClientError } from '@/lib/api/errors'
import { DIRECT_SYNC_STATUS, directSyncUnderDevelopmentMessage } from '@/lib/integrations/direct-sync-status'

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
    if (disabled || DIRECT_SYNC_STATUS.isPaused) {
      setAccounts([])
      return
    }

    try {
      const data = await apiRequestData<any[]>('/api/v1/tradovate/synchronizations', {
        method: 'GET',
        retry: { mode: 'safe' },
        operation: 'load-tradovate-accounts',
      })
      const list = Array.isArray(data) ? data : []
      setAccounts(list.map(normalizeSynchronization))
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 503) {
        logger.info({ error: error.message }, 'Tradovate direct sync is paused/unavailable')
        setAccounts([])
        return
      }
      reportError(error, { surface: 'client', operation: 'load-tradovate-accounts', route: '/api/v1/tradovate/synchronizations' })
    }
  }, [disabled, normalizeSynchronization])

  const updateIncludedFeeTypesForAccount = useCallback(
    async (accountId: string, includedFeeTypes: Record<string, boolean>) => {
      if (disabled || DIRECT_SYNC_STATUS.isPaused) {
        return { success: false, error: directSyncUnderDevelopmentMessage('Tradovate') }
      }

      try {
        await apiRequestData(
          '/api/v1/tradovate/synchronizations',
          {
            method: 'PATCH',
            body: JSON.stringify({ accountId, includedFeeTypes }),
          },
        )
        await loadAccounts()
        return { success: true }
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 503) {
          return { success: false, error: directSyncUnderDevelopmentMessage('Tradovate') }
        }
        reportError(error, { surface: 'client', operation: 'update-tradovate-fees', entityId: accountId })
        return { success: false, error: error instanceof Error ? error.message : 'Failed to update' }
      }
    },
    [disabled, loadAccounts]
  )

  const deleteAccount = useCallback(async (accountId: string) => {
    setAccounts(prev => prev.filter(acc => acc.accountId !== accountId))
    if (disabled || DIRECT_SYNC_STATUS.isPaused) return
    try {
      await apiRequestData('/api/v1/tradovate/synchronizations', {
        method: 'DELETE',
        body: JSON.stringify({ accountId }),
      })
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 503) return
      reportError(error, { surface: 'client', operation: 'delete-tradovate-account', entityId: accountId })
    }
  }, [disabled])

  const performSyncForAccount = useCallback(async (accountId: string) => {
    if (disabled || DIRECT_SYNC_STATUS.isPaused) {
      return { success: false, message: directSyncUnderDevelopmentMessage('Tradovate') }
    }

    const account = accounts.find(acc => acc.accountId === accountId)
    if (!account) {
      const errorMsg = `Account ${accountId} not found`
      return { success: false, message: errorMsg }
    }

    if (!account.tokenExpiresAt || new Date(account.tokenExpiresAt).getTime() <= Date.now()) {
      const errorMsg = `Token for account ${accountId} is expired`
      return { success: false, message: errorMsg }
    }

    try {
      const runSync = async () => {
        logger.debug({ accountId }, 'Starting Tradovate sync')
        if (!account.tokenExpiresAt || new Date(account.tokenExpiresAt).getTime() <= Date.now()) {
          const errorMsg = `Token for account ${accountId} is expired`
          throw new Error(errorMsg)
        }

        const resultData = await apiRequestData<{
          insertedTrades?: number
          skippedTrades?: number
          unmatchedClosingOrders?: number
        }>('/api/v1/tradovate/sync', {
          method: 'POST',
          body: JSON.stringify({ accountId }),
        })

        let successMessage = `Sync complete: ${resultData?.insertedTrades || 0} trades inserted.`
        if (resultData?.skippedTrades && resultData.skippedTrades > 0) {
          successMessage += ` ${resultData.skippedTrades} duplicate trades skipped.`
        }
        if (resultData?.unmatchedClosingOrders && resultData.unmatchedClosingOrders > 0) {
          successMessage += ` ${resultData.unmatchedClosingOrders} unmatched closing orders found.`
        }
        if (resultData?.insertedTrades === 0 && (!resultData?.skippedTrades || resultData.skippedTrades === 0)) {
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
    if (disabled || DIRECT_SYNC_STATUS.isPaused) return
    if (isAutoSyncing) {
      return
    }

    setIsAutoSyncing(true)

    try {
      const validAccounts = accounts.filter(acc => acc.tokenExpiresAt && new Date(acc.tokenExpiresAt).getTime() > Date.now())
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
    if (!enableAutoSync || disabled || DIRECT_SYNC_STATUS.isPaused) return

    const dueAt = accounts
      .filter((account) => account.lastSyncedAt)
      .map((account) => new Date(account.lastSyncedAt).getTime() + syncInterval * 60 * 1000)

    if (dueAt.length === 0) return

    const delay = Math.max(0, Math.min(...dueAt) - Date.now())
    nextSyncTimerRef.current = setTimeout(() => {
      void checkAndPerformSyncsRef.current()
    }, Math.min(delay, 2_147_000_000))
  }, [accounts, disabled, enableAutoSync, syncInterval, clearNextSyncTimer])

  const checkAndPerformSyncs = useCallback(async () => {
    if (disabled || DIRECT_SYNC_STATUS.isPaused) {
      clearNextSyncTimer()
      return
    }
    if (document.visibilityState === 'hidden') return
    if (!enableAutoSync || isAutoSyncing) return

    try {
      const now = Date.now()

      for (const account of accounts) {

        if (!account.tokenExpiresAt || new Date(account.tokenExpiresAt).getTime() <= Date.now()) continue

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
  }, [disabled, enableAutoSync, isAutoSyncing, accounts, syncInterval, performSyncForAccount, scheduleNextSync, clearNextSyncTimer]);

  checkAndPerformSyncsRef.current = checkAndPerformSyncs

  useDatabaseRealtime({
    userId: user?.id,
    enabled: enableAutoSync && !disabled && !DIRECT_SYNC_STATUS.isPaused,
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
    if (disabled || DIRECT_SYNC_STATUS.isPaused) {
      clearNextSyncTimer()
      return
    }
    scheduleNextSync()
    return clearNextSyncTimer
  }, [disabled, scheduleNextSync, clearNextSyncTimer])

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
