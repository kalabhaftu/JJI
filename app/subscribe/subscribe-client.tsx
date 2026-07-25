'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { CreditCard, Shield, Zap, BarChart3, ArrowRight, Tag, CheckCircle2, Loader2, LogOut } from 'lucide-react'
import { toast } from 'sonner'

import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/context/auth-provider'

const FEATURES = [
  { icon: BarChart3, text: 'Advanced analytics & performance tracking' },
  { icon: Zap, text: 'Real-time trade journaling with AI insights' },
  { icon: Shield, text: 'Prop firm phase management & risk alerts' },
  { icon: CreditCard, text: 'Pay with any cryptocurrency' },
]

export function SubscribeClient() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth()
  const router = useRouter()
  const [promoCode, setPromoCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [promoValidation, setPromoValidation] = useState<{ valid: boolean; description?: string } | null>(null)

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.replace('/login?next=/subscribe')
    }
  }, [isAuthenticated, isAuthLoading, router])

  if (isAuthLoading || !isAuthenticated) return null

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
        toast.error('Payment Error', { description: data.error || 'Failed to create invoice' })
        return
      }

      if (data.freeAccess) {
        toast.success('Access Granted!', { description: 'Redirecting to dashboard...' })
        router.push('/dashboard')
        return
      }

      if (data.invoiceUrl) {
        // Store payment record ID for status polling
        if (data.paymentRecordId) {
          sessionStorage.setItem('pendingPaymentId', data.paymentRecordId)
        }
        // Redirect to NOWPayments hosted invoice page
        window.location.href = data.invoiceUrl
      }
    } catch (error) {
      toast.error('Error', { description: 'Something went wrong. Please try again.' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        {/* Header */}
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

        {/* Pricing Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="rounded-2xl border border-border/60 bg-card/50 backdrop-blur-sm p-6 shadow-lg"
        >
          {/* Price */}
          <div className="text-center mb-6 pb-6 border-b border-border/40">
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-4xl font-bold tracking-tight">$10</span>
              <span className="text-muted-foreground text-sm">/month</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Pay with any cryptocurrency</p>
          </div>

          {/* Features */}
          <div className="space-y-3 mb-6">
            {FEATURES.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="flex items-center gap-3 text-sm"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span className="text-muted-foreground">{feature.text}</span>
              </motion.div>
            ))}
          </div>

          {/* Promo Code */}
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
          </div>

          {/* Subscribe Button */}
          <Button
            onClick={handleSubscribe}
            disabled={isLoading}
            className="w-full h-11 text-sm font-medium bg-primary hover:bg-primary/90"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating invoice...
              </>
            ) : (
              <>
                Subscribe Now
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>

          <p className="text-[10px] text-muted-foreground/60 text-center mt-3">
            Secure payment powered by NOWPayments. Cancel anytime.
          </p>
        </motion.div>

        {/* Sign out */}
        <div className="text-center mt-6">
          <Button
            variant="ghost"
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
      </motion.div>
    </div>
  )
}
