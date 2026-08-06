'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { describeBillingStatus } from '@/lib/subscription/billing-status'
import { cn } from '@/lib/utils'
import type { BillingStatus } from '@/stores/subscription-store'

interface StatusCardProps {
  status: BillingStatus
  trialEndsAt?: string | null
}

const badgeTones = {
  green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  red: 'border-red-200 bg-red-50 text-red-700',
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
  gray: 'border-slate-200 bg-slate-50 text-slate-600',
} as const

export function StatusCard({ status, trialEndsAt }: StatusCardProps) {
  if (status === 'unknown') {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Subscription status
        </p>
        <div aria-hidden="true" className="mt-3 h-4 w-2/3 animate-pulse rounded bg-slate-200" />
        <div aria-hidden="true" className="mt-2 h-4 w-1/3 animate-pulse rounded bg-slate-200" />
      </div>
    )
  }

  const view = describeBillingStatus({
    status,
    ...(trialEndsAt === undefined ? {} : { trialEndsAt }),
  })

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Subscription status
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <Badge
          variant="outline"
          className={cn('h-7 rounded-full border px-3 text-[11px] font-bold', badgeTones[view.badge])}
        >
          {view.label}
        </Badge>
        <Link
          href="/subscribe"
          className="text-sm font-semibold text-blue-600 underline-offset-2 hover:underline"
        >
          Upgrade
        </Link>
      </div>
      <p className="mt-3 text-sm text-slate-600">
        {status === 'active' && 'You have full access to journaling.'}
        {status === 'trialing' && 'Your trial is active until the date shown above.'}
        {status === 'expired-trial' && 'Your trial has ended. Upgrade to continue.'}
        {status === 'inactive' && 'Upgrade to unlock journaling and full access.'}
      </p>
    </div>
  )
}
