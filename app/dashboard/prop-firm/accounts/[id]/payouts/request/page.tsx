'use client'

import { Spinner } from '@/components/ui/spinner'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from "@/context/auth-provider"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, DollarSign, AlertCircle, CheckCircle2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { RequestPayoutPageSkeleton } from '../../components/account-loading-skeletons'

interface EligibilityData {
  isEligible: boolean
  daysSinceFunded: number
  daysSinceLastPayout: number
  netProfitSinceLastPayout: number
  minDaysRequired: number
  profitSplitAmount: number
  blockers: string[]
}

interface AccountData {
  id: string
  number: string
  name?: string
  propfirm: string
  currentPhase?: {
    id: string
    phaseNumber: number
  }
}

export default function RequestPayoutPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()

  const [account, setAccount] = useState<AccountData | null>(null)
  const [eligibility, setEligibility] = useState<EligibilityData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')

  const accountId = params.id as string

  // Fetch eligibility data
  useEffect(() => {
    if (!user) return

    const fetchData = async () => {
      try {
        setIsLoading(true)

        // Fetch account and eligibility in parallel
        const [accountRes, payoutsRes] = await Promise.all([
          fetch(`/api/v1/prop-firm/accounts/${accountId}`),
          fetch(`/api/v1/prop-firm/accounts/${accountId}/payouts`)
        ])

        if (!accountRes.ok || !payoutsRes.ok) {
          throw new Error('Failed to fetch data')
        }

        const accountData = await accountRes.json()
        const payoutsData = await payoutsRes.json()

        if (accountData.success) {
          setAccount(accountData.data.account)
        }

        if (payoutsData.success && payoutsData.data.eligibility) {
          setEligibility(payoutsData.data.eligibility)
          // Set suggested amount to profit split amount
          if (payoutsData.data.eligibility.profitSplitAmount > 0) {
            setAmount(payoutsData.data.eligibility.profitSplitAmount.toFixed(2))
          }
        }
      } catch (error) {
        toast.error('Failed to load payout eligibility')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [accountId, user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!account?.currentPhase?.id) {
      toast.error('Account phase information not available')
      return
    }

    const payoutAmount = parseFloat(amount)
    if (isNaN(payoutAmount) || payoutAmount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    if (eligibility && payoutAmount > eligibility.profitSplitAmount) {
      toast.error(`Amount exceeds available balance ($${eligibility.profitSplitAmount.toFixed(2)})`)
      return
    }

    try {
      setIsSubmitting(true)

      const response = await fetch('/api/v1/prop-firm/payouts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          masterAccountId: accountId,
          phaseAccountId: account.currentPhase.id,
          amount: payoutAmount,
          notes: notes.trim() || undefined
        })
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Payout request submitted successfully')
        router.push(`/dashboard/prop-firm/accounts/${accountId}/payouts`)
      } else {
        throw new Error(data.error || 'Failed to submit payout request')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit payout request')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return <RequestPayoutPageSkeleton />
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/dashboard/prop-firm/accounts/${accountId}/payouts`)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Request Payout</h1>
          <p className="text-muted-foreground">
            {account?.name || account?.number} • {account?.propfirm}
          </p>
        </div>
      </div>

      {/* Eligibility Check */}
      {eligibility && !eligibility.isEligible && (
        <Card className="border-warning">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning" />
              <CardTitle>Payout Not Available</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              You are not yet eligible to request a payout. Please meet the following requirements:
            </p>
            <ul className="space-y-2">
              {eligibility.blockers.map((blocker, index) => (
                <li key={index} className="flex items-center gap-2 text-sm">
                  <div className="h-1.5 w-1.5 rounded-full bg-warning" />
                  {blocker}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Eligibility Confirmed */}
      {eligibility && eligibility.isEligible && (
        <Card className="border-long">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-long" />
              <CardTitle>Eligible for Payout</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Days Since Funded</div>
                <div className="text-2xl font-bold">{eligibility.daysSinceFunded}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Days Since Last Payout</div>
                <div className="text-2xl font-bold">{eligibility.daysSinceLastPayout}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Net Profit</div>
                <div className="text-2xl font-bold">${eligibility.netProfitSinceLastPayout.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Available Balance</div>
                <div className="text-2xl font-bold text-long">
                  ${eligibility.profitSplitAmount.toFixed(2)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payout Request Form */}
      <Card>
        <CardHeader>
          <CardTitle>Payout Details</CardTitle>
          <CardDescription>
            Enter the amount you wish to withdraw from your funded account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount ($)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  max={eligibility?.profitSplitAmount || undefined}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="pl-10"
                  required
                  disabled={!eligibility?.isEligible || isSubmitting}
                />
              </div>
              {eligibility && (
                <p className="text-sm text-muted-foreground">
                  Maximum available: ${eligibility.profitSplitAmount.toFixed(2)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any additional information about this payout request..."
                rows={4}
                disabled={!eligibility?.isEligible || isSubmitting}
              />
            </div>

            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={!eligibility?.isEligible || isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <Spinner className="h-4 w-4 mr-2" />
                    Submitting...
                  </>
                ) : (
                  'Submit Payout Request'
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/dashboard/prop-firm/accounts/${accountId}/payouts`)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
