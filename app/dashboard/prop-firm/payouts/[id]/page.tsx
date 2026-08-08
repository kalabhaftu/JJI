'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from "@/context/auth-provider"
import { toast } from "sonner"
import { reportClientError } from '@/lib/observability/report-error'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowLeft01Icon,
  RefreshIcon,
  Dollar01Icon,
  Calendar01Icon,
  CreditCardIcon,
  AlertCircleIcon,
  CircleCheckIcon,
  Clock01Icon,
  PencilEdit01Icon,
  Delete02Icon
} from '@hugeicons/core-free-icons'
import { cn } from "@/lib/utils"
import { useQuery } from '@tanstack/react-query'
import { apiRequestData } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/query-keys'
import { useQueryScope, isScopeReady } from '@/lib/query/use-query-scope'
import { GlobalPayoutDetailSkeleton } from "../components/payout-loading-skeletons"

interface PayoutData {
  id: string
  accountId: string
  accountNumber: string
  amountRequested: number
  amountPaid: number
  status: 'pending' | 'approved' | 'paid' | 'rejected'
  requestedAt: string
  paidAt?: string
  notes?: string
}

interface AccountSummary {
  id: string
  number: string
}

interface AccountPayoutRowProps {
  account: AccountSummary
  payoutId: string
  refreshSignal: number
  onResult: (accountId: string, payout: PayoutData | null) => void
}

function AccountPayoutRow({ account, payoutId, refreshSignal, onResult }: AccountPayoutRowProps) {
  const scope = useQueryScope()
  const query = useQuery({
    queryKey: queryKeys.payouts(scope, { accountId: account.id }),
    queryFn: ({ signal }) =>
      apiRequestData<{ history?: Array<Omit<PayoutData, 'accountId' | 'accountNumber'>> }>(`/api/v1/prop-firm/accounts/${account.id}/payouts`, {
        signal,
        operation: 'load-prop-firm-payouts',
      }),
    enabled: isScopeReady(scope),
    staleTime: 30_000,
  })

  useEffect(() => {
    if (query.isSuccess && query.data?.history) {
      const match = query.data.history.find((p) => p.id === payoutId) ?? null
      onResult(account.id, match ? { ...match, accountId: account.id, accountNumber: account.number } : null)
    }
  }, [query.isSuccess, query.data, payoutId, account.id, account.number, onResult])

  useEffect(() => {
    if (query.error) {
      reportClientError(query.error, { operation: 'load-prop-firm-payout-details', route: `/dashboard/prop-firm/payouts/${payoutId}` })
      toast.error('Failed to fetch payout details', {
        description: 'An error occurred while fetching payout details'
      })
      onResult(account.id, null)
    }
  }, [query.error, payoutId, account.id, onResult])

  useEffect(() => {
    if (refreshSignal > 0) {
      query.refetch()
    }
  }, [refreshSignal, query])

  return null
}

export default function PayoutDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const scope = useQueryScope()
  const [results, setResults] = useState<Record<string, PayoutData | null>>({})
  const [refreshSignal, setRefreshSignal] = useState(0)

  const payoutId = params.id as string

  const accountsQuery = useQuery({
    queryKey: queryKeys.propFirmAccounts(scope),
    queryFn: ({ signal }) =>
      apiRequestData<AccountSummary[]>('/api/v1/prop-firm/accounts', {
        signal,
        operation: 'load-prop-firm-payouts',
      }),
    enabled: isScopeReady(scope) && !!user,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (accountsQuery.error) {
      reportClientError(accountsQuery.error, { operation: 'load-prop-firm-payout-details', route: `/dashboard/prop-firm/payouts/${payoutId}` })
      toast.error('Failed to fetch payout details', {
        description: 'An error occurred while fetching payout details'
      })
    }
  }, [accountsQuery.error, payoutId])

  const onResult = useCallback((accountId: string, payout: PayoutData | null) => {
    setResults((prev) => (prev[accountId] === payout ? prev : { ...prev, [accountId]: payout }))
  }, [])

  const payout = useMemo(() => {
    return Object.values(results).find((p) => p !== null) ?? null
  }, [results])

  const allAccountsSettled = useMemo(() => {
    const accounts = accountsQuery.data
    if (!accounts) return false
    return accounts.length === 0 || accounts.every((account) => account.id in results)
  }, [accountsQuery.data, results])

  const hasAccountsError = Boolean(accountsQuery.error)
  const settled = hasAccountsError || allAccountsSettled
  const isLoading = accountsQuery.isPending || (accountsQuery.isSuccess && !settled)

  const notFound = !isLoading && settled && !payout

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-warning'
      case 'approved': return 'bg-foreground'
      case 'paid': return 'bg-long'
      case 'rejected': return 'bg-short'
      default: return 'bg-muted-foreground'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <HugeiconsIcon icon={Clock01Icon} className="h-4 w-4" strokeWidth={2} />
      case 'approved': return <HugeiconsIcon icon={CircleCheckIcon} className="h-4 w-4" strokeWidth={2} />
      case 'paid': return <HugeiconsIcon icon={CircleCheckIcon} className="h-4 w-4" strokeWidth={2} />
      case 'rejected': return <HugeiconsIcon icon={AlertCircleIcon} className="h-4 w-4" strokeWidth={2} />
      default: return <HugeiconsIcon icon={Clock01Icon} className="h-4 w-4" strokeWidth={2} />
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const handleRefresh = () => {
    setRefreshSignal((n) => n + 1)
  }

  if (isLoading) {
    return <GlobalPayoutDetailSkeleton />
  }

  if (notFound) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <HugeiconsIcon icon={AlertCircleIcon} className="h-12 w-12 text-muted-foreground mx-auto mb-4" strokeWidth={2} />
            <h3 className="text-lg font-semibold mb-2">Payout Not Found</h3>
            <p className="text-muted-foreground">The requested payout could not be found.</p>
            <Button onClick={() => router.back()} className="mt-4">
              <HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4 mr-2" strokeWidth={2} />
              Go Back
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!payout) {
    return null
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {(accountsQuery.data ?? []).map((account) => (
        <AccountPayoutRow
          key={account.id}
          account={account}
          payoutId={payoutId}
          refreshSignal={refreshSignal}
          onResult={onResult}
        />
      ))}
      {            }
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="tertiary"
            size="sm"
            onClick={() => router.push('/dashboard/prop-firm/payouts')}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4 mr-2" strokeWidth={2} />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Payout Details</h1>
            <p className="text-muted-foreground">View and manage payout information</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            {isLoading ? <Spinner className="mr-2 h-4 w-4" /> : <HugeiconsIcon icon={RefreshIcon} className="mr-2 h-4 w-4"  strokeWidth={2}/>}
            Refresh
          </Button>
          <Button variant="secondary" size="sm">
            <HugeiconsIcon icon={PencilEdit01Icon} className="h-4 w-4 mr-2" strokeWidth={2} />
            Edit
          </Button>
          <Button variant="secondary" size="sm" className="text-short hover:text-short/80">
            <HugeiconsIcon icon={Delete02Icon} className="h-4 w-4 mr-2" strokeWidth={2} />
            Delete
          </Button>
        </div>
      </div>

      {                    }
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HugeiconsIcon icon={CreditCardIcon} className="h-5 w-5" strokeWidth={2} />
              Payout Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge className={cn("text-white", getStatusColor(payout.status))}>
                <div className="flex items-center gap-1">
                  {getStatusIcon(payout.status)}
                  <span className="capitalize">{payout.status}</span>
                </div>
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Account</span>
              <span className="font-medium">{payout.accountNumber}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Requested Amount</span>
              <div className="flex items-center gap-1">
                <HugeiconsIcon icon={Dollar01Icon} className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
                <span className="font-medium">{formatCurrency(payout.amountRequested)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Paid Amount</span>
              <div className="flex items-center gap-1">
                <HugeiconsIcon icon={Dollar01Icon} className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
                <span className="font-medium">{formatCurrency(payout.amountPaid)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Requested Date</span>
              <div className="flex items-center gap-1">
                <HugeiconsIcon icon={Calendar01Icon} className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
                <span className="font-medium">{formatDate(payout.requestedAt)}</span>
              </div>
            </div>

            {payout.paidAt && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Paid Date</span>
                <div className="flex items-center gap-1">
                  <HugeiconsIcon icon={Calendar01Icon} className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
                  <span className="font-medium">{formatDate(payout.paidAt)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Additional Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {payout.notes ? (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Notes</h4>
                <p className="text-sm">{payout.notes}</p>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No additional information available</p>
              </div>
            )}

            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Actions</h4>
              <div className="flex flex-wrap gap-2">
                {payout.status === 'pending' && (
                  <>
                    <Button size="sm">Approve</Button>
                    <Button size="sm" variant="secondary" className="text-short hover:text-short/80">
                      Reject
                    </Button>
                  </>
                )}
                {payout.status === 'approved' && (
                  <Button size="sm">Mark as Paid</Button>
                )}
                <Button size="sm" variant="secondary">Download Receipt</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {                         }
      <Card>
        <CardHeader>
          <CardTitle>Related Account</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Account {payout.accountNumber}</h3>
              <p className="text-muted-foreground">View account details and trading history</p>
            </div>
            <Button onClick={() => router.push(`/dashboard/prop-firm/accounts/${payout.accountId}`)}>
              View Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
