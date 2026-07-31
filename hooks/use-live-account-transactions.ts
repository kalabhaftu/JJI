import { useState, useEffect } from 'react'
import { useUserStore } from '@/store/user-store'

interface Transaction {
  id: string
  accountId: string
  type: 'DEPOSIT' | 'WITHDRAWAL'
  amount: number
  description?: string
  createdAt: string
}

export function useLiveAccountTransactions() {
  const user = useUserStore(state => state.user)
  const isDemo = typeof window !== 'undefined' && window.location.pathname.startsWith('/demo')

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        if (isDemo) {
          setTransactions([
            {
              id: 'mock-tx-1',
              accountId: 'mock-acc-1',
              type: 'DEPOSIT',
              amount: 100000,
              description: 'Initial Deposit',
              createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
            }
          ])
          return
        }

        const response = await fetch('/api/v1/live-accounts/transactions')
        const result = await response.json()

        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch transactions')
        }

        setTransactions(result.data || [])
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to fetch transactions')
      } finally {
        setIsLoading(false)
      }
    }

    fetchTransactions()
  }, [isDemo])

  return { transactions, isLoading, error }
}

