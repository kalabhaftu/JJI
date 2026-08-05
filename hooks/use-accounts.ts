'use client'

import { useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useUserStore } from '@/store/user-store'
import { isDemoSurface } from '@/lib/public-surface-routing'
import { apiRequestData } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/query-keys'
import { useQueryScope, isScopeReady } from '@/lib/query/use-query-scope'

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

export function useAccounts(options: UseAccountsOptions = {}) {

  const mappedStatus = options.includeArchived ? 'archived' : options.includeFailed ? 'all' : 'active'
  const filterStatus = options.status || mappedStatus

  const {
    page = 1,
    limit = 50,
    status = filterStatus,
    type = options.type || 'all',
    search = options.search || ''
  } = options

  const queryClient = useQueryClient()
  const scope = useQueryScope()
  const user = useUserStore(state => state.user)
  const isDemo = typeof window !== 'undefined' && isDemoSurface(window.location.hostname, window.location.pathname)

  const filters = useMemo(() => ({ page, limit, status, type, search }), [limit, page, search, status, type])
  const url = `/api/v1/accounts?page=${page}&limit=${limit}&status=${status}&type=${type}&search=${encodeURIComponent(search)}`
  const query = useQuery({
    queryKey: queryKeys.accounts(scope, filters),
    queryFn: ({ signal }) => apiRequestData<any>(url, { signal, operation: 'load-accounts' }),
    enabled: isScopeReady(scope) && Boolean(user?.id || isDemo),
    placeholderData: (previous) => previous,
    staleTime: 30_000,
  })
  const data = query.data

  const accounts: UnifiedAccount[] = useMemo(() => {
    return data?.data || []
  }, [data])
  const pagination = data?.meta?.pagination || { total: 0, page: 1, limit: 50, totalPages: 1 }

  const refetch = useCallback(async () => {
    await query.refetch()
  }, [query])

  const updateAccountInCache = useCallback((accountId: string, partialData: Partial<UnifiedAccount>) => {
    if (!data) return
    const updatedAccounts = accounts.map((acc: UnifiedAccount) =>
      acc.id === accountId ? { ...acc, ...partialData } : acc
    )
    queryClient.setQueryData(queryKeys.accounts(scope, filters), { ...data, data: updatedAccounts })
  }, [data, accounts, filters, queryClient, scope])

  return {
    accounts,
    pagination,
    isLoading: query.isLoading && !data,
    isFetching: query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
    refetch,
    updateAccountInCache
  }
}
