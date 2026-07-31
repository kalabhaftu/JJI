'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from "@/context/auth-provider"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import {
  ArrowLeft,
  RefreshCcw,
  Plus,
  Search,
  Filter,
  DollarSign,
  Calendar,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Trash2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { AccountStatus, PhaseType } from "@/types/prop-firm"
import { AccountPayoutHistorySkeleton, AccountPayoutsPageSkeleton } from "../components/account-loading-skeletons"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface PayoutData {
  id: string
  amountRequested: number
  amountPaid: number
  status: 'pending' | 'approved' | 'paid' | 'rejected'
  requestedAt: string
  paidAt?: string
  notes?: string
}

interface AccountData {
  id: string
  number: string
  name?: string
  propfirm: string
  status: AccountStatus
  currentEquity: number
  currentBalance: number
  isEligibleForPayout: boolean
  daysSinceFunded: number
  daysSinceLastPayout: number
  minProfitRequired?: number
  netProfitSinceLastPayout: number
}

export default function AccountPayoutsPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [payouts, setPayouts] = useState<PayoutData[]>([])
  const [account, setAccount] = useState<AccountData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [deletingPayoutId, setDeletingPayoutId] = useState<string | null>(null)
  const [deletePayoutTarget, setDeletePayoutTarget] = useState<string | null>(null)

  const accountId = params.id as string

  // Fetch account details
  const fetchAccount = async () => {
    try {
      const response = await fetch(`/api/v1/prop-firm/accounts/${accountId}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch account details')
      }

      const data = await response.json()
      if (data.success) {
        setAccount(data.data.account)
      } else {
        throw new Error(data.error || 'Failed to fetch account details')
      }
    } catch (error) {
      toast.error('Failed to fetch account details', {
        description: 'An error occurred while fetching account details'
      })
    }
  }

  // Fetch payouts
  const fetchPayouts = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/v1/prop-firm/accounts/${accountId}/payouts`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch payouts')
      }

      const data = await response.json()
      if (data.success) {
        setPayouts(data.data)
      } else {
        throw new Error(data.error || 'Failed to fetch payouts')
      }
    } catch (error) {
      toast.error('Failed to fetch payouts', {
        description: 'An error occurred while fetching payouts'
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Load data on mount
  useEffect(() => {
    if (user && accountId) {
      fetchAccount()
      fetchPayouts()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, accountId])

  if (isLoading && !account) {
    return <AccountPayoutsPageSkeleton />
  }

  if (!account) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <ArrowLeft className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Account Not Found</h3>
            <p className="text-muted-foreground">The requested account could not be found.</p>
            <Button onClick={() => router.back()} className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }

    const handleDeletePayout = async (payoutId: string) => {
    setDeletePayoutTarget(payoutId)
  }

  const handleDeletePayoutConfirm = async () => {
    if (!deletePayoutTarget) return
    try {
      setDeletingPayoutId(deletePayoutTarget)

      const response = await fetch(`/api/v1/prop-firm/payouts/${deletePayoutTarget}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Payout request deleted successfully')
        fetchPayouts()
      } else {
        throw new Error(data.error || 'Failed to delete payout')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete payout')
    } finally {
      setDeletingPayoutId(null)
      setDeletePayoutTarget(null)
    }
  }

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
      case 'paid': return <CreditCard className="h-4 w-4" />
      case 'rejected': return <AlertTriangle className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  return (
    <>
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/dashboard/prop-firm/accounts/${accountId}`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Payouts</h1>
            <p className="text-muted-foreground">
              {account.name || account.number} • {account.propfirm}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchPayouts}
            disabled={isLoading}
          >
            {isLoading ? <Spinner className="mr-2 h-4 w-4" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
          {account.isEligibleForPayout && (
            <Button
              onClick={() => router.push(`/dashboard/prop-firm/accounts/${accountId}/payouts/request`)}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Request Payout
            </Button>
          )}
        </div>
      </div>

      {/* Account Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Account Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Current Equity</p>
              <p className="text-2xl font-bold">{formatCurrency(account.currentEquity)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Net Profit Since Last Payout</p>
              <p className="text-2xl font-bold">{formatCurrency(account.netProfitSinceLastPayout)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Days Since Funded</p>
              <p className="text-2xl font-bold">{account.daysSinceFunded}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payouts List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Payout History</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search payouts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <AccountPayoutHistorySkeleton />
          ) : payouts.length === 0 ? (
            <div className="text-center py-8">
              <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Payouts Yet</h3>
              <p className="text-muted-foreground mb-4">
                This account hasn&apos;t had any payout requests yet.
              </p>
              {account.isEligibleForPayout && (
                <Button onClick={() => router.push(`/dashboard/prop-firm/accounts/${accountId}/payouts/request`)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Request First Payout
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {payouts
                .filter(payout => 
                  payout.amountRequested.toString().includes(searchTerm) ||
                  payout.status.includes(searchTerm) ||
                  payout.notes?.includes(searchTerm)
                )
                .map((payout) => (
                  <div key={payout.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className={cn("p-2 rounded-full", getStatusColor(payout.status))}>
                        {getStatusIcon(payout.status)}
                      </div>
                      <div>
                        <p className="font-semibold">{formatCurrency(payout.amountRequested)}</p>
                        <p className="text-sm text-muted-foreground">
                          Requested {new Date(payout.requestedAt).toLocaleDateString()}
                        </p>
                        {payout.notes && (
                          <p className="text-xs text-muted-foreground mt-1 max-w-md">
                            {payout.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={cn(getStatusColor(payout.status), 'text-white')}>
                        {payout.status.toUpperCase()}
                      </Badge>
                      {payout.status === 'pending' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePayout(payout.id)}
                          disabled={deletingPayoutId === payout.id}
                        >
                          {deletingPayoutId === payout.id ? (
                            <Spinner className="h-4 w-4" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>

    {/* Delete Payout Confirmation Dialog */}
    <AlertDialog open={!!deletePayoutTarget} onOpenChange={(open) => !open && setDeletePayoutTarget(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Payout Request</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this payout request? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeletePayoutConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
