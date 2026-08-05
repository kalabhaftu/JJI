'use client'

import { useQuery } from '@tanstack/react-query'
import { useUserStore } from '@/store/user-store'
import { isDemoSurface } from '@/lib/public-surface-routing'
import { apiRequestData } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/query-keys'
import { useQueryScope, isScopeReady } from '@/lib/query/use-query-scope'

interface Transaction {
  id: string
  accountId: string
  type: 'DEPOSIT' | 'WITHDRAWAL'
  amount: number
  description?: string
  createdAt: string
}

export function useLiveAccountTransactions(accountId?: string) {
  const scope = useQueryScope()
  const user = useUserStore(state => state.user)
  const isDemo = typeof window !== 'undefined' && isDemoSurface(window.location.hostname, window.location.pathname)

  const query = useQuery({
    queryKey: queryKeys.accountTransactions(scope, accountId || ''),
    queryFn: async ({ signal }) => {
      if (isDemo) {
        return [
          {
            id: 'mock-tx-1',
            accountId: 'mock-acc-1',
            type: 'DEPOSIT',
            amount: 100000,
            description: 'Initial Deposit',
            createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
          }
        ] as Transaction[]
      }

      const url = accountId
        ? `/api/v1/live-accounts/${accountId}/transactions`
        : '/api/v1/live-accounts/transactions'
      const data = await apiRequestData<Transaction[]>(url, {
        signal,
        operation: 'load-live-account-transactions',
      })
      return data || []
    },
    enabled: isScopeReady(scope) && Boolean(user?.id || isDemo),
    staleTime: 30_000,
  })

  return {
    transactions: query.data || [],
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
  }
}
