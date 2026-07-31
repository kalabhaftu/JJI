'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Minus, Calendar, DollarSign } from "lucide-react"
import { format } from 'date-fns'

interface Transaction {
  id: string
  type: 'DEPOSIT' | 'WITHDRAWAL'
  amount: number
  description?: string
  createdAt: string
}

interface TransactionHistoryProps {
  accountId: string
}

export function TransactionHistory({ accountId }: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTransactions = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/v1/live-accounts/${accountId}/transactions`)
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
  }, [accountId])

  useEffect(() => {
    fetchTransactions()
  }, [accountId, fetchTransactions])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Transaction History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="w-20 h-4" />
                    <Skeleton className="w-32 h-3" />
                  </div>
                </div>
                <Skeleton className="w-16 h-6" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Transaction History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-short mb-2">Error loading transactions</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <button
              onClick={fetchTransactions}
              className="mt-4 text-sm text-accent hover:underline"
            >
              Try again
            </button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Transaction History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No transactions yet</p>
            <p className="text-sm text-muted-foreground">
              Deposits and withdrawals will appear here
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Transaction History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${transaction.type === 'DEPOSIT'
                  ? 'bg-long/10 text-long'
                  : 'bg-short/10 text-short'
                  }`}>
                  {transaction.type === 'DEPOSIT' ? (
                    <Plus className="w-4 h-4" />
                  ) : (
                    <Minus className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {transaction.type === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'}
                    </span>
                    <Badge variant={transaction.type === 'DEPOSIT' ? 'success' : 'destructive'}>
                      {transaction.type}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(transaction.createdAt), 'MMM dd, yyyy HH:mm')}
                  </div>
                  {transaction.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {transaction.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className={`font-semibold ${transaction.type === 'DEPOSIT' ? 'text-long' : 'text-short'
                  }`}>
                  {transaction.type === 'DEPOSIT' ? '+' : '-'}${Math.abs(transaction.amount).toFixed(2)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
