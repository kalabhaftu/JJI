'use client'

import { useCallback, useMemo } from 'react'
import { useUserStore } from '@/store/user-store'
import { useRouter } from 'next/navigation'
import useSWR, { mutate } from 'swr'
import { reportError } from '@/lib/observability/report-error'
import { isDemoSurface } from '@/lib/public-surface-routing'
import { reportClientError } from '@/lib/observability/report-error'

interface UnifiedAccount {
  id: string
  number: string
  name: string
  propfirm: string
  broker: string | undefined
  startingBalance: number
  calculatedEquity?: number
  pnl?: number
  currentBalance?: number
  currentEquity?: number
  status: 'active' | 'failed' | 'funded' | 'passed' | 'pending'
  createdAt: string
  userId: string
  groupId: string | null
  group: any
  accountType: 'prop-firm' | 'live'
  displayName: string
  tradeCount: number
  owner: any
  isOwner: boolean
  currentPhase: any
  phaseAccountNumber?: string | null
  isArchived?: boolean
  currentPhaseDetails?: any
}

interface UseAccountsOptions {
  includeFailed?: boolean
  includeArchived?: boolean
  page?: number
  limit?: number
  status?: 'all' | 'active' | 'failed' | 'archived'
  type?: 'all' | 'live' | 'prop-firm'
  search?: string
}

// Global broadcast system for cache updates
const realtimeSubscribers = new Set<() => void>()

function broadcastAccountsUpdate() {
  realtimeSubscribers.forEach(callback => {
    try {
      callback()
    } catch (error) {
      reportError(error, {
        surface: 'client',
        operation: 'notify-account-cache-subscriber',
      })
    }
  })
}

function subscribeToAccountsUpdates(callback: () => void) {
  realtimeSubscribers.add(callback)
  return () => realtimeSubscribers.delete(callback)
}

export function invalidateAccountsCache(_reason?: string) { }

export function clearAccountsCache() {
  mutate(key => typeof key === 'string' && key.startsWith('/api/v1/accounts'))
}

const fetcher = async (url: string) => {
  try {
    const response = await fetch(url)
    const payload = await response.json()
    if (!response.ok) {
      throw Object.assign(new Error(payload.error?.message || 'Failed to load accounts'), { status: response.status })
    }
    return payload
  } catch (error) {
    reportClientError(error, { operation: 'load-accounts', route: url })
    throw error
  }
}

export function useAccounts(options: UseAccountsOptions = {}) {
  // Legacy support for older options
  const mappedStatus = options.includeArchived ? 'archived' : options.includeFailed ? 'all' : 'active'
  const filterStatus = options.status || mappedStatus

  const { 
    page = 1, 
    limit = 50, 
    status = filterStatus, 
    type = options.type || 'all', 
    search = options.search || ''
  } = options
  
  const router = useRouter()
  const user = useUserStore(state => state.user)
  const isDemo = typeof window !== 'undefined' && isDemoSurface(window.location.hostname, window.location.pathname)

  const url = (user?.id || isDemo) ? `/api/v1/accounts?page=${page}&limit=${limit}&status=${status}&type=${type}&search=${encodeURIComponent(search)}` : null
  
  const { data, error, isLoading, mutate } = useSWR(url, fetcher, {
    keepPreviousData: true,
  })

  const accounts: UnifiedAccount[] = useMemo(() => {
    return data?.data || []
  }, [data])
  const pagination = data?.meta?.pagination || { total: 0, page: 1, limit: 50, totalPages: 1 }

  const refetch = useCallback(async () => {
    await mutate()
  }, [mutate])

  // Real-time patching function (Part of Phase 3/4)
  const updateAccountInCache = useCallback((accountId: string, partialData: Partial<UnifiedAccount>) => {
    if (!data) return
    const updatedAccounts = accounts.map((acc: UnifiedAccount) => 
      acc.id === accountId ? { ...acc, ...partialData } : acc
    )
    mutate({ ...data, data: updatedAccounts }, false) // false = don't revalidate immediately
  }, [data, accounts, mutate])

  return {
    accounts,
    pagination,
    isLoading: isLoading && !data, // Only perfectly true loading
    isFetching: isLoading, // Background fetching
    error: error ? error.message : null,
    refetch,
    updateAccountInCache
  }
}
