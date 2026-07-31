'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { CheckCircle2, Loader2, Clock } from 'lucide-react'

import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'

export default function SubscribeSuccessPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'checking' | 'confirmed' | 'pending'>('checking')

  useEffect(() => {
    let attempts = 0
    const maxAttempts = 15

    async function checkStatus() {
      try {
        const res = await fetch('/api/v1/subscription/status')
        const data = await res.json()

        if (data.success && data.data?.hasAccess) {
          setStatus('confirmed')
          return true
        }
      } catch {
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
  }, [])

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
              Please wait while we confirm your payment securely. Your account will be upgraded momentarily.
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
              Your subscription is now active! We've sent an email with your receipt and onboarding details.
            </p>
            <Button onClick={() => {
              router.refresh()
              router.push('/dashboard')
            }} className="mt-4 w-full">
              Enter Dashboard →
            </Button>
          </div>
        )}

        {status === 'pending' && (
          <div className="space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Clock className="h-8 w-8 text-amber-500" />
            </div>
            <h1 className="text-xl font-semibold">Verification Delayed</h1>
            <p className="text-sm text-muted-foreground">
              Your payment was successful, but our server hasn't received the confirmation from Whop yet. 
              This usually resolves in a minute. You can safely go to your dashboard, and it will unlock automatically.
            </p>
            <Button onClick={() => {
              router.refresh()
              router.push('/dashboard')
            }} className="mt-4 w-full">
              Go to Dashboard
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  )
}
