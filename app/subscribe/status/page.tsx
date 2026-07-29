'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Clock, Loader2, RefreshCw, XCircle } from 'lucide-react'

import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type PaymentStatus = {
  providerStatus: string | null
  amountUsd: number
  payCurrency: string | null
  payAmount: number | null
  invoiceUrl: string | null
  paymentUrl: string | null
  canOpenInvoice: boolean
  paidAt: string | null
  expiredAt: string | null
  expiresAt: string | null
  subscriptionPeriodEnd: string | null
}

export default function SubscribeStatusPage() {
  const router = useRouter()
  const [paymentId, setPaymentId] = useState<string | null>(null)
  const [status, setStatus] = useState<PaymentStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadStatus = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/v1/payments/status?paymentRecordId=${id}&refresh=true`)
      const payload = await response.json()
      if (!payload.success) throw new Error(payload.error?.message || 'Unable to load payment status')
      setStatus(payload.data)
      if (payload.data?.providerStatus === 'finished') {
        sessionStorage.removeItem('pendingPaymentId')
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load payment status')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    const stored = sessionStorage.getItem('pendingPaymentId')
    setPaymentId(stored)
    if (stored) {
      loadStatus(stored)
    } else {
      setLoading(false)
      setError('No pending payment was found in this browser session.')
    }
  }, [loadStatus])

  const providerStatus = status?.providerStatus || 'unknown'
  const isFinished = providerStatus === 'finished'
  const isFailed = ['failed', 'expired', 'refunded'].includes(providerStatus)

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center space-y-6">
          <div className="flex items-center justify-center gap-2">
            <Logo className="h-8 w-8" />
            <span className="text-lg font-bold tracking-tight">JJI</span>
          </div>

          {loading ? (
            <div className="space-y-3">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <h1 className="text-xl font-semibold">Checking payment</h1>
              <p className="text-sm text-muted-foreground">We are checking the latest server-side status.</p>
            </div>
          ) : error ? (
            <div className="space-y-4">
              <XCircle className="mx-auto h-10 w-10 text-destructive" />
              <h1 className="text-xl font-semibold">Status unavailable</h1>
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button onClick={() => router.push('/subscribe')} className="w-full">Start Payment</Button>
            </div>
          ) : (
            <div className="space-y-4">
              {isFinished ? (
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
              ) : isFailed ? (
                <XCircle className="mx-auto h-10 w-10 text-destructive" />
              ) : (
                <Clock className="mx-auto h-10 w-10 text-amber-500" />
              )}

              <div>
                <h1 className="text-xl font-semibold">
                  {isFinished ? 'Payment confirmed' : isFailed ? 'Payment not completed' : 'Payment processing'}
                </h1>
                <div className="mt-2 flex justify-center">
                  <Badge variant={isFinished ? 'success' : isFailed ? 'destructive' : 'warning'}>
                    {providerStatus}
                  </Badge>
                </div>
              </div>

              <div className="rounded-md border border-border/60 bg-muted/20 p-4 text-left text-sm space-y-2">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Amount</span>
                  <span>${status?.amountUsd?.toFixed(2)}</span>
                </div>
                {status?.payCurrency && (
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Currency</span>
                    <span className="uppercase">{status.payCurrency}</span>
                  </div>
                )}
                {status?.subscriptionPeriodEnd && (
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Access until</span>
                    <span>{new Date(status.subscriptionPeriodEnd).toLocaleDateString()}</span>
                  </div>
                )}
                {status?.expiresAt && !isFinished && (
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Payment window</span>
                    <span>{new Date(status.expiresAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                {isFinished ? (
                  <Button onClick={() => {
                    router.refresh()
                    router.push('/dashboard')
                  }} className="w-full">Go to Dashboard</Button>
                ) : isFailed ? (
                  <Button onClick={() => router.push('/subscribe')} className="w-full">Try Again</Button>
                ) : (
                  <>
                    <Button onClick={() => paymentId && loadStatus(paymentId)} className="w-full">
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh Status
                    </Button>
                    {status?.canOpenInvoice && status?.paymentUrl && (
                      <Button variant="outline" onClick={() => { 
                        window.location.href = status.paymentUrl!
                      }} className="w-full">
                        Open Invoice
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
