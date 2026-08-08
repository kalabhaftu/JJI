'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAuth } from "@/context/auth-provider"
import { toast } from "sonner"
import { reportClientError } from '@/lib/observability/report-error'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowLeft01Icon,
  RefreshIcon,
  Dollar01Icon,
  Calendar01Icon,
  CreditCardIcon,
  Alert02Icon,
  CircleCheckIcon,
  Clock01Icon
} from '@hugeicons/core-free-icons'
import { useRouter } from 'next/navigation'
import { cn } from "@/lib/utils"
import { useQuery } from '@tanstack/react-query'
import { apiRequestData } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/query-keys'
import { useQueryScope, isScopeReady } from '@/lib/query/use-query-scope'
import { GlobalPayoutListSkeleton, GlobalPayoutsPageSkeleton } from "./components/payout-loading-skeletons"

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

interface PropFirmAccountWithPayouts {
  id: string
  number: string
  name?: string
  payouts?: Array<Omit<PayoutData, 'accountNumber' | 'accountName'>>
}

export default function PayoutsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const scope = useQueryScope()
  const [searchTerm, setSearchTerm] = useState('')

  const payoutsQuery = useQuery({
    queryKey: queryKeys.payouts(scope, {}),
    queryFn: ({ signal }) =>
      apiRequestData<PropFirmAccountWithPayouts[]>('/api/v1/prop-firm/accounts', {
        signal,
        operation: 'load-prop-firm-payouts',
      }),
    enabled: isScopeReady(scope) && !!user,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (payoutsQuery.error) {
      reportClientError(payoutsQuery.error, { operation: 'load-prop-firm-payouts', route: '/dashboard/prop-firm/payouts' })
      toast.error('Failed to fetch payouts', {
        description: 'An error occurred while fetching payouts'
      })
    }
  }, [payoutsQuery.error])

  const payouts = useMemo(
    () => (payoutsQuery.data ?? []).flatMap((account) =>
      account.payouts ? account.payouts.map((payout) => ({
        ...payout,
        accountNumber: account.number,
        accountName: account.name
      })) : []
    ),
    [payoutsQuery.data]
  )

  const isLoading = payoutsQuery.isLoading

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
      case 'rejected': return <HugeiconsIcon icon={Alert02Icon} className="h-4 w-4" strokeWidth={2} />
      default: return <HugeiconsIcon icon={Clock01Icon} className="h-4 w-4" strokeWidth={2} />
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const filteredPayouts = payouts.filter(payout =>
    payout.accountNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payout.status.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (isLoading && payouts.length === 0) {
    return <GlobalPayoutsPageSkeleton />
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {            }
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="tertiary"
            size="sm"
            onClick={() => router.push('/dashboard/prop-firm')}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4 mr-2" strokeWidth={2} />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Payouts</h1>
            <p className="text-muted-foreground">Manage your prop firm payouts</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => payoutsQuery.refetch()}
            disabled={isLoading}
          >
            {isLoading ? <Spinner className="mr-2 h-4 w-4" /> : <HugeiconsIcon icon={RefreshIcon} className="mr-2 h-4 w-4"  strokeWidth={2}/>}
            Refresh
          </Button>
        </div>
      </div>

      {            }
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Input
            placeholder="Search payouts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {                  }
      {isLoading ? (
        <GlobalPayoutListSkeleton />
      ) : filteredPayouts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64">
            <HugeiconsIcon icon={Alert02Icon} className="h-12 w-12 text-muted-foreground mb-4" strokeWidth={2} />
            <h3 className="text-lg font-semibold mb-2">
              {searchTerm ? 'No results found' : 'No payouts found'}
            </h3>
            <p className="text-muted-foreground">
              {searchTerm ? 'Try a different search term' : 'You have not requested any payouts yet'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredPayouts.map((payout) => (
            <Card key={payout.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">Account {payout.accountNumber}</h3>
                      <Badge className={cn("text-white", getStatusColor(payout.status))}>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(payout.status)}
                          <span className="capitalize">{payout.status}</span>
                        </div>
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center gap-2">
                        <HugeiconsIcon icon={Dollar01Icon} className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
                        <div>
                          <p className="text-xs text-muted-foreground">Requested</p>
                          <p className="font-medium">{formatCurrency(payout.amountRequested)}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <HugeiconsIcon icon={CreditCardIcon} className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
                        <div>
                          <p className="text-xs text-muted-foreground">Paid</p>
                          <p className="font-medium">{formatCurrency(payout.amountPaid)}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <HugeiconsIcon icon={Calendar01Icon} className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
                        <div>
                          <p className="text-xs text-muted-foreground">Requested Date</p>
                          <p className="font-medium">{formatDate(payout.requestedAt)}</p>
                        </div>
                      </div>
                    </div>

                    {payout.paidAt && (
                      <div className="flex items-center gap-2">
                        <HugeiconsIcon icon={Calendar01Icon} className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
                        <div>
                          <p className="text-xs text-muted-foreground">Paid Date</p>
                          <p className="font-medium">{formatDate(payout.paidAt)}</p>
                        </div>
                      </div>
                    )}

                    {payout.notes && (
                      <div>
                        <p className="text-xs text-muted-foreground">Notes</p>
                        <p className="text-sm">{payout.notes}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => router.push(`/dashboard/prop-firm/payouts/${payout.id}`)}
                    >
                      View Details
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
