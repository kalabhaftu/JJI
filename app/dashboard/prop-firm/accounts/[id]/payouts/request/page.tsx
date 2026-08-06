'use client'

import { Spinner } from '@/components/ui/spinner'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from "@/context/auth-provider"
import { toast } from "sonner"
import { reportClientError } from '@/lib/observability/report-error'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { CurrencyField } from '@/components/ui/domain-fields'
import { focusFirstInvalidField, parseNumericInput } from '@/lib/form-fields'
import { ArrowLeft, DollarSign, AlertCircle, CheckCircle2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequestData } from '@/lib/api/client'
import { queryKeys, queryKeyPrefixes } from '@/lib/query/query-keys'
import { useQueryScope, isScopeReady } from '@/lib/query/use-query-scope'
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
  const queryClient = useQueryClient()
  const scope = useQueryScope()

  const [isSubmitting, setIsSubmitting] = useState(false)

  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const prefilledRef = useRef(false)

  const accountId = params.id as string

  const accountQuery = useQuery({
    queryKey: queryKeys.propFirmAccount(scope, accountId),
    queryFn: ({ signal }) =>
      apiRequestData<{ account: AccountData }>(`/api/v1/prop-firm/accounts/${accountId}`, {
        signal,
        operation: 'load-prop-firm-account',
      }),
    enabled: isScopeReady(scope) && !!user && Boolean(accountId),
    staleTime: 30_000,
  })

  const eligibilityQuery = useQuery({
    queryKey: queryKeys.payouts(scope, { accountId }),
    queryFn: ({ signal }) =>
      apiRequestData<{ eligibility: EligibilityData }>(`/api/v1/prop-firm/accounts/${accountId}/payouts`, {
        signal,
        operation: 'load-payout-eligibility',
      }),
    enabled: isScopeReady(scope) && !!user && Boolean(accountId),
    staleTime: 30_000,
  })

  const account = accountQuery.data?.account ?? null
  const eligibility = eligibilityQuery.data?.eligibility ?? null

  useEffect(() => {
    if (eligibilityQuery.error) {
      reportClientError(eligibilityQuery.error, { operation: 'load-payout-eligibility', route: `/api/v1/prop-firm/accounts/${accountId}/payouts` })
      toast.error('Failed to load payout eligibility')
    }
  }, [eligibilityQuery.error, accountId])

  useEffect(() => {
    if (!prefilledRef.current && eligibility?.profitSplitAmount && eligibility.profitSplitAmount > 0) {
      prefilledRef.current = true
      setAmount(String(eligibility.profitSplitAmount))
    }
  }, [eligibility])

  const payoutMutation = useMutation({
    mutationFn: (payload: { masterAccountId: string; phaseAccountId: string; amount: number; notes?: string }) =>
      apiRequestData('/api/v1/prop-firm/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterAccountId: payload.masterAccountId,
          phaseAccountId: payload.phaseAccountId,
          amount: payload.amount,
          notes: payload.notes?.trim() || undefined,
        }),
        retry: { mode: 'never' },
        operation: 'submit-payout-request',
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeyPrefixes.payouts(scope) })
      await queryClient.invalidateQueries({ queryKey: queryKeyPrefixes.propFirmAccounts(scope) })

      toast.success('Payout request submitted successfully')
      router.push(`/dashboard/prop-firm/accounts/${accountId}/payouts`)
    },
    onError: (error) => {
      reportClientError(error, { operation: 'submit-payout-request', route: `/api/v1/prop-firm/accounts/${accountId}/payouts` })
      toast.error(error instanceof Error ? error.message : 'Failed to submit payout request')
    },
    onSettled: () => {
      setIsSubmitting(false)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!account?.currentPhase?.id) {
      toast.error('Account phase information not available')
      return
    }

    const payoutAmount = parseFloat(amount)
    if (isNaN(payoutAmount) || payoutAmount <= 0) {
      focusFirstInvalidField(document)
      toast.error('Please enter a valid amount')
      return
    }

    if (eligibility && payoutAmount > eligibility.profitSplitAmount) {
      focusFirstInvalidField(document)
      toast.error(`Amount exceeds available balance ($${eligibility.profitSplitAmount.toFixed(2)})`)
      return
    }

    setIsSubmitting(true)
    payoutMutation.mutate({
      masterAccountId: accountId,
      phaseAccountId: account.currentPhase.id,
      amount: payoutAmount,
      notes: notes,
    })
  }

  const isLoading = accountQuery.isLoading || eligibilityQuery.isLoading
  const parsedAmount = parseFloat(amount)
  const amountInvalid =
    amount === '' ||
    isNaN(parsedAmount) ||
    parsedAmount <= 0 ||
    (eligibility != null && parsedAmount > eligibility.profitSplitAmount)

  if (isLoading) {
    return <RequestPayoutPageSkeleton />
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {            }
      <div className="flex items-center gap-4">
        <Button
          variant="tertiary"
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

      {                       }
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

      {                           }
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

      {                         }
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
                <CurrencyField
                  id="amount"
                  aria-label="Payout amount"
                  aria-invalid={amountInvalid ? true : undefined}
                  value={amount === '' ? undefined : (parseNumericInput(amount) ?? undefined)}
                  onValueChange={(next) => setAmount(next === undefined ? '' : String(next))}
                  placeholder="0.00"
                  className="pl-10"
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
                variant="secondary"
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
