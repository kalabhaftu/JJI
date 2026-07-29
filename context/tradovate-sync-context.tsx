'use client'

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { useData } from '@/context/data-provider'
import { toast } from 'sonner'
import { type SynchronizationType } from '@/lib/db/schema'
import { DEFAULT_INCLUDED_FEE_TYPES } from '@/app/dashboard/components/import/tradovate/sync/fee-types'
import logger from '@/lib/logger'

interface TradovateSyncContextType {
  // Core sync management
  performSyncForAccount: (accountId: string) => Promise<{ success: boolean; message: string } | undefined>
  performSyncForAllAccounts: () => Promise<void>
  
  // State management
  isAutoSyncing: boolean
  
  // Account management
  accounts: SynchronizationType[]
  loadAccounts: () => Promise<void>
  deleteAccount: (accountId: string) => Promise<void>
  
  // Per-account fee config (stored in DB)
  getIncludedFeeTypesForAccount: (accountId: string) => Record<string, boolean>
  updateIncludedFeeTypesForAccount: (accountId: string, includedFeeTypes: Record<string, boolean>) => Promise<{ success: boolean; error?: string }>
  
  // Auto-sync functionality
  syncInterval: number
  setSyncInterval: (interval: number) => void
  enableAutoSync: boolean
  setEnableAutoSync: (enabled: boolean) => void
}

const TradovateSyncContext = createContext<TradovateSyncContextType | undefined>(undefined)

export function TradovateSyncContextProvider({ children, disabled = false }: { children: ReactNode; disabled?: boolean }) {
  const [isAutoSyncing, setIsAutoSyncing] = useState(false)
  const [accounts, setAccounts] = useState<SynchronizationType[]>([])
  const [syncInterval, setSyncInterval] = useState(15) // 15 minutes default
  const [enableAutoSync, setEnableAutoSync] = useState(false)

  const getIncludedFeeTypesForAccount = useCallback((accountId: string) => {
    const account = accounts.find((a) => a.accountId === accountId)
    const raw = (account as any)?.includedFeeTypes
    if (raw && typeof raw === 'object') {
      return { ...DEFAULT_INCLUDED_FEE_TYPES, ...raw } as Record<string, boolean>
    }
    return { ...DEFAULT_INCLUDED_FEE_TYPES }
  }, [accounts])

  const { refreshTrades } = useData()

  // Normalize dates and fee config returned from API
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

  // Load accounts from API
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
      console.warn('Failed to load Tradovate accounts:', error)
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

  // Perform sync for a specific account
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

        // Handle duplicate trades (already imported)
        const responseMessage = payload?.error?.message ?? payload?.message
        if (responseMessage === "DUPLICATE_TRADES") {
          return "All trades from this account have already been imported"
        }
        
        if (!response.ok || !payload?.success) {
          const errorMsg = responseMessage || `Sync error for account ${accountId}`
          throw new Error(errorMsg)
        }

        // Track progress
        const savedCount = payload.savedCount || 0
        const ordersCount = payload.ordersCount || 0

        logger.debug({ accountId, savedCount, ordersCount }, 'Tradovate sync complete')

        // Show success message
        let successMessage: string
        if (savedCount > 0) {
          successMessage = `Sync complete: ${savedCount} trades saved, ${ordersCount} orders processed for account ${accountId}.`
        } else if (ordersCount > 0) {
          successMessage = `Sync complete: No new trades found. ${ordersCount} orders processed for account ${accountId}.`
        } else {
          successMessage = `Sync complete: No orders found for account ${accountId}.`
        }

        // Refresh the accounts list to update last sync time
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
      console.error('Sync error:', error)
      return { success: false, message: errorMsg }
    }
  }, [accounts, disabled, refreshTrades, loadAccounts])

  // Perform sync for all accounts
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

      // Sync accounts sequentially to avoid overwhelming the API
      for (const account of validAccounts) {
        await performSyncForAccount(account.accountId)
        // Small delay between accounts
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

    } catch (error) {
      console.error('Error during bulk sync:', error)
    } finally {
      setIsAutoSyncing(false)
    }
  }, [disabled, isAutoSyncing, accounts, performSyncForAccount])

  // Auto-sync checking
  const checkAndPerformSyncs = useCallback(async () => {
    if (disabled) return
    if (!enableAutoSync || isAutoSyncing) return

    try {
      const now = Date.now()
      
      // Check each account's last sync time
      for (const account of accounts) {
        // If we don't have a token, skip this account
        if (!account.token) continue

        const lastSyncTime = new Date(account.lastSyncedAt).getTime()
        const minutesSinceLastSync = (now - lastSyncTime) / (1000 * 60)

        if (minutesSinceLastSync >= syncInterval) {
          logger.debug({ accountId: account.accountId }, 'Tradovate auto-sync triggered')
          await performSyncForAccount(account.accountId)
        }
      }
    } catch (error) {
      console.warn('Error during tradovate auto-sync check:', error)
    }
  }, [disabled, enableAutoSync, isAutoSyncing, accounts, syncInterval, performSyncForAccount]);

  // Auto-sync checking interval
  useEffect(() => {
    if (!enableAutoSync) return

    const intervalMs = 1 * 60 * 1000  // 1 minute

    const intervalId = setInterval(() => {
      checkAndPerformSyncs()
    }, intervalMs)

    // Cleanup on unmount
    return () => {
      clearInterval(intervalId)
    }
  }, [enableAutoSync, checkAndPerformSyncs])

  // Load accounts on mount
  useEffect(() => {
    loadAccounts()
  }, [loadAccounts])

  return (
    <TradovateSyncContext.Provider value={{
      // Core sync management
      performSyncForAccount,
      performSyncForAllAccounts,
      
      // State management
      isAutoSyncing,
      
      // Account management
      accounts,
      loadAccounts,
      deleteAccount,
      
      // Per-account fee config
      getIncludedFeeTypesForAccount,
      updateIncludedFeeTypesForAccount,
      
      // Auto-sync functionality
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
