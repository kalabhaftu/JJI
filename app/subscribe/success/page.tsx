'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { CheckCircle2, Loader2, Clock } from 'lucide-react'

import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { reportError } from '@/lib/observability/report-error'

export default function SubscribeSuccessPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'checking' | 'confirmed' | 'pending'>('checking')
  const [provider, setProvider] = useState<'whop' | 'crypto' | 'unknown'>('unknown')

  useEffect(() => {
    const paymentId = sessionStorage.getItem('pendingPaymentId')
    const whopReferenceId = sessionStorage.getItem('whopReferenceId')
    const selectedProvider = new URLSearchParams(window.location.search).get('provider') === 'whop'
      || whopReferenceId
      ? 'whop'
      : paymentId ? 'crypto' : 'unknown'
    setProvider(selectedProvider)
    if (selectedProvider === 'unknown') {
      setStatus('pending')
      return
    }

    let attempts = 0
    let reportedFailure = false
    const maxAttempts = selectedProvider === 'whop' ? 15 : 10

    async function checkStatus() {
      try {
        const endpoint = selectedProvider === 'whop'
          ? '/api/v1/billing/status'
          : `/api/v1/payments/status?paymentRecordId=${encodeURIComponent(paymentId!)}&refresh=true`
        const res = await fetch(endpoint)
        const data = await res.json()

        if (!res.ok) {
          throw new Error(`Subscription confirmation failed with status ${res.status}`)
        }

        if (data.success && data.data) {
          if (
            (selectedProvider === 'whop' && data.data.hasAccess)
            || (selectedProvider === 'crypto' && data.data.providerStatus === 'finished')
          ) {
            setStatus('confirmed')
            sessionStorage.removeItem('pendingPaymentId')
            sessionStorage.removeItem('whopReferenceId')
            router.refresh()
            return true
          }
          if (
            (selectedProvider === 'crypto'
              && ['failed', 'expired', 'refunded'].includes(data.data.providerStatus))
            || (selectedProvider === 'whop'
              && ['canceled', 'expired'].includes(data.data.providerStatus))
          ) {
            router.replace('/subscribe/cancelled')
            return true
          }
        }
      } catch (error) {
        if (!reportedFailure) {
          reportedFailure = true
          reportError(error, {
            surface: 'client',
            operation: 'poll-subscription-confirmation',
            route: '/subscribe/success',
            tags: { provider: selectedProvider },
          })
        }
        return false
      }
      return false
    }

    const interval = setInterval(async () => {
      attempts++
      const done = await checkStatus()
      if (done || attempts >= maxAttempts) {
        clearInterval(interval)
        if (attempts >= maxAttempts) setStatus('pending')
      }
    }, 5000)

    checkStatus()

    return () => clearInterval(interval)
  }, [router])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm text-center"
      >
        <div className="flex items-center justify-center gap-2 mb-8">
          <Logo className="w-8 h-8" />
          <span className="text-lg font-bold tracking-tight">JJI</span>
        </div>

        {status === 'checking' && (
          <div className="space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
            <h1 className="text-xl font-semibold">Verifying Payment...</h1>
            <p className="text-sm text-muted-foreground">
              Please wait while the payment provider confirms your subscription.
            </p>
          </div>
        )}

        {status === 'confirmed' && (
          <div className="space-y-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center"
            >
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </motion.div>
            <h1 className="text-xl font-semibold">Payment Confirmed!</h1>
            <p className="text-sm text-muted-foreground">
              Your subscription is now active. Welcome to JJI Pro!
            </p>
            <Button onClick={() => {
              router.refresh()
              router.push('/dashboard')
            }} className="mt-4 w-full">
              Go to Dashboard →
            </Button>
          </div>
        )}

        {status === 'pending' && (
          <div className="space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Clock className="h-8 w-8 text-amber-500" />
            </div>
            <h1 className="text-xl font-semibold">Payment Processing</h1>
            <p className="text-sm text-muted-foreground">
              Confirmation is taking longer than expected. Access opens automatically after server-side verification.
            </p>
            <Button
              variant="outline"
              onClick={() => router.push(provider === 'crypto' ? '/subscribe/status' : '/dashboard')}
              className="mt-4 w-full"
            >
              {provider === 'crypto' ? 'Check Status' : 'Go to Dashboard'}
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  )
}
