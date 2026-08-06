'use client'

import { useRouter } from 'next/navigation'
import { XCircle, ArrowLeft, RefreshCw } from 'lucide-react'

import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'

export default function SubscribeCancelledPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Logo className="w-8 h-8" />
          <span className="text-lg font-bold tracking-tight">JJI</span>
        </div>

        <div className="space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <XCircle className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-xl font-semibold">Payment Cancelled</h1>
          <p className="text-sm text-muted-foreground">
            Your payment was cancelled or failed. No charges were made.
          </p>
          <div className="flex flex-col gap-2 mt-6">
            <Button onClick={() => router.push('/subscribe')} className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            <Button variant="tertiary" onClick={() => router.push('/')} className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
