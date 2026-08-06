'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CreditCard, Shield, Zap, BarChart3, ArrowRight, Tag, CheckCircle2, X, Loader2, LogOut } from 'lucide-react'
import { toast } from 'sonner'

import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/context/auth-provider'
import { reportClientError, reportError } from '@/lib/observability/report-error'

export function SubscribeClient({ whopEnabled }: { whopEnabled: boolean }) {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth()
  const router = useRouter()
  const [promoCode, setPromoCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isWhopLoading, setIsWhopLoading] = useState(false)
  const [promoValidation, setPromoValidation] = useState<{ valid: boolean; description?: string } | null>(null)
  const features = [
    { icon: BarChart3, text: 'Advanced analytics & performance tracking' },
    { icon: Zap, text: 'Real-time trade journaling with AI insights' },
    { icon: Shield, text: 'Prop firm phase management & risk alerts' },
    {
      icon: CreditCard,
      text: whopEnabled ? 'Card and cryptocurrency payment options' : 'Secure cryptocurrency payment',
    },
  ]

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.replace('/login?next=/subscribe')
    }
  }, [isAuthenticated, isAuthLoading, router])

  useEffect(() => {
    const code = promoCode.trim()
    if (code.length < 3) {
      setPromoValidation(null)
      return
    }

    let cancelled = false
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch('/api/v1/payments/validate-promo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        })
        const data = await res.json()
        if (cancelled) return

        if (res.ok && data.success) {
          setPromoValidation({ valid: true, description: data.data?.discountDescription })
        } else {
          setPromoValidation({ valid: false, description: data.error?.message || 'Invalid promo code' })
        }
      } catch {
        if (!cancelled) setPromoValidation(null)
      }
    }, 350)

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [promoCode])

  async function handleSubscribe() {
    setIsLoading(true)
    try {
      const res = await fetch('/api/v1/payments/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promoCode: promoCode || undefined }),
      })

      const data = await res.json()

      if (!data.success) {
        toast.error('Payment Error', { description: data.error?.message || 'Failed to create invoice' })
        return
      }
      const payment = data.data

      if (payment?.freeAccess) {
        toast.success('Access Granted!', { description: 'Redirecting to dashboard...' })
        router.push('/dashboard')
        return
      }

      const paymentUrl = payment?.paymentUrl || payment?.invoiceUrl
      if (paymentUrl) {

        if (payment.paymentRecordId) {
          sessionStorage.setItem('pendingPaymentId', payment.paymentRecordId)
        }

        window.location.href = paymentUrl
      }
    } catch (error) {
      reportError(error, {
        surface: 'client',
        operation: 'create-crypto-checkout',
        route: '/subscribe',
      })
      toast.error('Error', { description: 'Something went wrong. Please try again.' })
    } finally {
      setIsLoading(false)
    }
  }

  async function handleWhopSubscribe() {
    setIsWhopLoading(true)
    try {
      const response = await fetch('/api/v1/payments/whop-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: 'pro' }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) {
        const requestId = payload.requestId ?? response.headers.get('x-request-id') ?? undefined
        reportClientError(Object.assign(new Error('Checkout initialization failed'), {
          status: response.status,
          code: payload.error?.code,
          requestId,
        }), {
          operation: 'create-whop-checkout-response',
          route: '/api/v1/payments/whop-checkout',
          status: response.status,
          ...(requestId ? { requestId } : {}),
          ...(payload.error?.code ? { extra: { code: payload.error.code } } : {}),
        })
        toast.error('Checkout Error', {
          description: payload.error?.message || 'Failed to initialize card checkout',
        })
        return
      }

      const checkout = payload.data
      if (!checkout?.checkoutUrl) throw new Error('Card checkout response is missing its URL')
      sessionStorage.setItem('whopReferenceId', checkout.referenceId)
      window.location.href = checkout.checkoutUrl
    } catch (error) {
      reportError(error, {
        surface: 'client',
        operation: 'create-whop-checkout',
        route: '/subscribe',
      })
      toast.error('Checkout Error', { description: 'Something went wrong. Please try again.' })
    } finally {
      setIsWhopLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {            }
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Logo className="w-8 h-8" />
            <span className="text-lg font-bold tracking-tight">JJI</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">Unlock JJI Pro</h1>
          <p className="text-muted-foreground text-sm">
            Get full access to your trading journal and analytics
          </p>
          <div className="mt-3 text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-border/40 text-center leading-relaxed">
            JJI was originally created for my personal use. If other traders wish to use it, a paid subscription is required to cover API costs and hosting.
          </div>
        </div>

        {                  }
        <div className="rounded-2xl border border-border/60 bg-card/50 backdrop-blur-sm p-6 shadow-lg">
          {           }
          <div className="text-center mb-6 pb-6 border-b border-border/40">
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-4xl font-bold tracking-tight">$10</span>
              <span className="text-muted-foreground text-sm">/month</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Card or cryptocurrency</p>
          </div>

          {              }
          <div className="space-y-3 mb-6">
            {features.map((feature) => (
              <div key={feature.text} className="flex items-center gap-3 text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span className="text-muted-foreground">{feature.text}</span>
              </div>
            ))}
          </div>

          {                }
          <div className="mb-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Promo code"
                  value={promoCode}
                  onChange={(e) => {
                    setPromoCode(e.target.value.toUpperCase())
                    setPromoValidation(null)
                  }}
                  className="pl-9 h-10 text-sm uppercase"
                />
              </div>
            </div>
            {promoValidation?.valid && (
              <p className="text-xs text-emerald-500 mt-1.5 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {promoValidation.description}
              </p>
            )}
            {promoValidation && !promoValidation.valid && (
              <p className="text-xs text-destructive mt-1.5 flex items-center gap-1">
                <X className="h-3 w-3" />
                {promoValidation.description}
              </p>
            )}
          </div>

          <div className="space-y-3">
            {whopEnabled && (
              <>
                <Button
                  onClick={handleWhopSubscribe}
                  disabled={isAuthLoading || !isAuthenticated || isLoading || isWhopLoading}
                  className="w-full h-11 text-sm font-medium"
                >
                  {isWhopLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating checkout...
                    </>
                  ) : (
                    <>
                      <CreditCard className="mr-2 h-4 w-4" />
                      Pay with Card
                    </>
                  )}
                </Button>

                <div className="relative" aria-hidden="true">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/40" /></div>
                  <div className="relative flex justify-center text-[10px] uppercase"><span className="bg-card px-2 text-muted-foreground">or</span></div>
                </div>
              </>
            )}

            <Button
              onClick={handleSubscribe}
              disabled={isAuthLoading || !isAuthenticated || isLoading || isWhopLoading}
              variant={whopEnabled ? "secondary" : "primary"}
              className="w-full h-11 text-sm font-medium"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating invoice...
                </>
              ) : (
                <>
                  Pay with Crypto
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>

          <p className="text-[10px] text-muted-foreground/60 text-center mt-3">
            {whopEnabled
              ? 'Secure payment via Whop or NOWPayments. Manage card subscriptions through Whop.'
              : 'Secure cryptocurrency payment powered by NOWPayments.'}
          </p>
          <p className="text-[10px] text-muted-foreground/60 text-center mt-2">
            Subscriptions renew until cancelled. Completed periods are non-refundable except billing errors or where required by law. <Link href="/terms" className="underline underline-offset-2 hover:text-muted-foreground">Terms</Link>
          </p>
        </div>

        {              }
        <div className="text-center mt-6">
          <Button
            variant="tertiary"
            size="sm"
            className="text-xs text-muted-foreground gap-2"
            onClick={async () => {
              const { createClient } = await import('@/lib/supabase')
              const supabase = createClient()
              await supabase.auth.signOut()
              localStorage.clear()
              sessionStorage.clear()
              window.location.href = '/'
            }}
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  )
}
