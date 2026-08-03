'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from "@/context/auth-provider"
import { toast } from "sonner"
import { reportClientError } from '@/lib/observability/report-error'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import {
  ArrowLeft,
  RefreshCcw,
  DollarSign,
  Calendar,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  Clock,
  Pencil,
  Trash2
} from "lucide-react"
import { cn } from "@/lib/utils"
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

export default function PayoutDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [payout, setPayout] = useState<PayoutData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const payoutId = params.id as string

  const fetchPayout = useCallback(async () => {
    try {
      setIsLoading(true)
      const accountsResponse = await fetch('/api/v1/prop-firm/accounts')
      if (!accountsResponse.ok) {
        throw new Error('Failed to fetch accounts')
      }
      const accountsData = await accountsResponse.json()
      if (!accountsData.success) {
        throw new Error('Failed to fetch accounts')
      }

      let foundPayout = null

      for (const account of accountsData.data) {
        const payoutsResponse = await fetch(`/api/v1/prop-firm/accounts/${account.id}/payouts`)
        if (payoutsResponse.ok) {
          const payoutsData = await payoutsResponse.json()
          if (payoutsData.success && payoutsData.data.history) {
            const payout = payoutsData.data.history.find((p: any) => p.id === payoutId)
            if (payout) {
              foundPayout = { ...payout, accountId: account.id, accountNumber: account.number }
              break
            }
          }
        }
      }

      if (!foundPayout) {
        throw new Error('Payout not found')
      }

      setPayout(foundPayout)
    } catch (error) {
      reportClientError(error, { operation: 'load-prop-firm-payout-details', route: `/dashboard/prop-firm/payouts/${payoutId}` })
      toast.error('Failed to fetch payout details', {
        description: 'An error occurred while fetching payout details'
      })
    } finally {
      setIsLoading(false)
    }
  }, [payoutId])

  useEffect(() => {
    if (user && payoutId) {
      fetchPayout()
    }
  }, [user, payoutId, fetchPayout])

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
      case 'pending': return <Clock className="h-4 w-4" />
      case 'approved': return <CheckCircle2 className="h-4 w-4" />
      case 'paid': return <CheckCircle2 className="h-4 w-4" />
      case 'rejected': return <AlertCircle className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  if (isLoading) {
    return <GlobalPayoutDetailSkeleton />
  }

  if (!payout) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Payout Not Found</h3>
            <p className="text-muted-foreground">The requested payout could not be found.</p>
            <Button onClick={() => router.back()} className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {            }
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/prop-firm/payouts')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Payout Details</h1>
            <p className="text-muted-foreground">View and manage payout information</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchPayout}
            disabled={isLoading}
          >
            {isLoading ? <Spinner className="mr-2 h-4 w-4" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button variant="outline" size="sm" className="text-short hover:text-short/80">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {                    }
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
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
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{formatCurrency(payout.amountRequested)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Paid Amount</span>
              <div className="flex items-center gap-1">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{formatCurrency(payout.amountPaid)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Requested Date</span>
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{formatDate(payout.requestedAt)}</span>
              </div>
            </div>

            {payout.paidAt && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Paid Date</span>
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
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
                    <Button size="sm" variant="outline" className="text-short hover:text-short/80">
                      Reject
                    </Button>
                  </>
                )}
                {payout.status === 'approved' && (
                  <Button size="sm">Mark as Paid</Button>
                )}
                <Button size="sm" variant="outline">Download Receipt</Button>
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
