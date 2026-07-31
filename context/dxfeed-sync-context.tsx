'use client'

import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from 'react'
import { useData } from '@/context/data-provider'
import { toast } from 'sonner'

/** Client-safe subset of Synchronization (token stripped, replaced with hasToken) */
export interface DxFeedSyncAccount {
  id: string
  userId: string
  service: string
  accountId: string
  hasToken: boolean
  accountNumbers: string[]
  lastSyncedAt: Date
  tokenExpiresAt: Date | null
  dailySyncTime: Date | null
  createdAt: Date
  updatedAt: Date
}

interface DxFeedSyncContextType {
  performSyncForAccount: (accountId: string) => Promise<{ success: boolean; message: string } | undefined>
  performSyncForAllAccounts: () => Promise<void>
  isAutoSyncing: boolean
  accounts: DxFeedSyncAccount[]
  loadAccounts: () => Promise<void>
  deleteAccount: (accountId: string) => Promise<void>
  syncInterval: number
  setSyncInterval: (interval: number) => void
  enableAutoSync: boolean
  setEnableAutoSync: (enabled: boolean) => void
}

const DxFeedSyncContext = createContext<DxFeedSyncContextType | undefined>(undefined)

export function DxFeedSyncContextProvider({ children, disabled = false }: { children: ReactNode; disabled?: boolean }) {
  const [isAutoSyncing, setIsAutoSyncing] = useState(false)
  const isAutoSyncingRef = useRef(false)
  const [accounts, setAccounts] = useState<DxFeedSyncAccount[]>([])
  const [syncInterval, setSyncInterval] = useState(15)
  const [enableAutoSync, setEnableAutoSync] = useState(false)

  const { refreshTrades } = useData()

  const normalizeSynchronization = useCallback(
    (sync: any): DxFeedSyncAccount => ({
      id: sync.id,
      userId: sync.userId,
      service: sync.service,
      accountId: sync.accountId,
      hasToken: !!sync.hasToken,
      accountNumbers: Array.isArray(sync.accountNumbers) ? sync.accountNumbers : [],
      lastSyncedAt: sync?.lastSyncedAt ? new Date(sync.lastSyncedAt) : new Date(),
      tokenExpiresAt: sync?.tokenExpiresAt ? new Date(sync.tokenExpiresAt) : null,
      dailySyncTime: sync?.dailySyncTime ? new Date(sync.dailySyncTime) : null,
      createdAt: sync?.createdAt ? new Date(sync.createdAt) : new Date(),
      updatedAt: sync?.updatedAt ? new Date(sync.updatedAt) : new Date(),
    }),
    [],
  )

  const loadAccounts = useCallback(async () => {
    if (disabled) {
      setAccounts([])
      return
    }

    try {
      const response = await fetch('/api/v1/dxfeed/synchronizations', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch DxFeed synchronizations')
      }

      const result = await response.json()
      const data = Array.isArray(result.data) ? result.data : []
      setAccounts(data.map(normalizeSynchronization))
    } catch (error) {
      console.warn('Failed to load DxFeed accounts:', error)
    }
  }, [disabled, normalizeSynchronization])

  const deleteAccount = useCallback(async (accountId: string) => {
    setAccounts((prev) => prev.filter((acc) => acc.accountId !== accountId))
    if (disabled) return
    await fetch('/api/v1/dxfeed/synchronizations', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId }),
    })
  }, [disabled])

  const performSyncForAccount = useCallback(
    async (accountId: string) => {
      if (disabled) {
        return { success: false, message: 'DxFeed sync is disabled in demo mode' }
      }

      const account = accounts.find((acc) => acc.accountId === accountId)
      if (!account) {
        return { success: false, message: `Account ${accountId} not found` }
      }

      if (!account.hasToken) {
        return { success: false, message: `Token for account ${accountId} is missing` }
      }

      try {
        const runSync = async () => {
          const response = await fetch('/api/v1/dxfeed/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accountId }),
          })

          const payload = await response.json()

          if (payload?.message === 'DUPLICATE_TRADES') {
            return "All trades from this account have already been imported"
          }

          if (!response.ok || !payload?.success) {
            throw new Error(payload?.message || `Sync error for account ${accountId}`)
          }

          const savedCount = payload.savedCount || 0
          const tradesCount = payload.tradesCount || 0

          let successMessage: string
          if (savedCount > 0) {
            successMessage = `Sync complete: ${savedCount} trades saved, ${tradesCount} trades processed for account ${accountId}.`
          } else if (tradesCount > 0) {
            successMessage = `Sync complete: No new trades found. ${tradesCount} trades processed for account ${accountId}.`
          } else {
            successMessage = `Sync complete: No trades found for account ${accountId}.`
          }

          await loadAccounts()
          await refreshTrades()

          return successMessage
        }

        const promise = runSync()
        toast.promise(promise, {
          loading: `Syncing DxFeed account ${accountId}...`,
          success: (msg: string) => msg,
          error: (e) => `Sync failed: ${e instanceof Error ? e.message : "Unknown error"}`
        })
        const message: string = await promise
        return { success: true, message }
      } catch (error) {
        const errorMsg = `Sync error for account ${accountId}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
        console.error('Sync error:', error)
        return { success: false, message: errorMsg }
      }
    },
    [accounts, disabled, refreshTrades, loadAccounts],
  )

  const performSyncForAllAccounts = useCallback(async () => {
    if (disabled) return
    if (isAutoSyncingRef.current) return

    isAutoSyncingRef.current = true
    setIsAutoSyncing(true)

    try {
      const validAccounts = accounts.filter((acc) => acc.hasToken)
      if (validAccounts.length === 0) return

      for (const account of validAccounts) {
        await performSyncForAccount(account.accountId)
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    } catch (error) {
      console.error('Error during bulk sync:', error)
    } finally {
      isAutoSyncingRef.current = false
      setIsAutoSyncing(false)
    }
  }, [accounts, disabled, performSyncForAccount])

  const checkAndPerformSyncs = useCallback(async () => {
    if (disabled) return
    if (!enableAutoSync || isAutoSyncingRef.current) return

    isAutoSyncingRef.current = true
    setIsAutoSyncing(true)

    try {
      const now = Date.now()

      for (const account of accounts) {
        if (!account.hasToken) continue

        const lastSyncTime = new Date(account.lastSyncedAt).getTime()
        const minutesSinceLastSync = (now - lastSyncTime) / (1000 * 60)

        if (minutesSinceLastSync >= syncInterval) {
          await performSyncForAccount(account.accountId)
        }
      }
    } catch (error) {
      console.warn('Error during dxfeed auto-sync check:', error)
    } finally {
      isAutoSyncingRef.current = false
      setIsAutoSyncing(false)
    }
  }, [disabled, enableAutoSync, accounts, syncInterval, performSyncForAccount])

  useEffect(() => {
    if (!enableAutoSync) return

    const intervalMs = 1 * 60 * 1000

    const intervalId = setInterval(() => {
      checkAndPerformSyncs()
    }, intervalMs)

    return () => {
      clearInterval(intervalId)
    }
  }, [enableAutoSync, checkAndPerformSyncs])

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts])

  return (
    <DxFeedSyncContext.Provider
      value={{
        performSyncForAccount,
        performSyncForAllAccounts,
        isAutoSyncing,
        accounts,
        loadAccounts,
        deleteAccount,
        syncInterval,
        setSyncInterval,
        enableAutoSync,
        setEnableAutoSync,
      }}
    >
      {children}
    </DxFeedSyncContext.Provider>
  )
}

export function useDxFeedSyncContext() {
  const context = useContext(DxFeedSyncContext)
  if (context === undefined) {
    throw new Error('useDxFeedSyncContext must be used within a DxFeedSyncContextProvider')
  }
  return context
}
