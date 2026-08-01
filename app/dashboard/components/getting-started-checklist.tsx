'use client'

import Link from 'next/link'
import { Check, ChevronRight, Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTour } from '@/context/tour-context'
import type { TourId } from '@/lib/tours/types'

const ITEMS: Array<{ id: Exclude<TourId, 'onboarding' | 'dashboard' | 'analytics'>; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'accounts', label: 'Accounts and import' },
  { id: 'trades', label: 'Trades' },
  { id: 'journal', label: 'Journal' },
  { id: 'reports', label: 'Reports' },
  { id: 'playbook', label: 'Playbook' },
  { id: 'backtesting', label: 'Backtesting' },
  { id: 'goals', label: 'Goals' },
  { id: 'assistant', label: 'Assistant' },
  { id: 'data', label: 'Data' },
  { id: 'settings', label: 'Settings' },
]

export function GettingStartedChecklist() {
  const { onboardingStatus, activeTour, startTour } = useTour()
  if (!onboardingStatus || onboardingStatus.setup === 'not_started' || activeTour) return null

  const completed = ITEMS.filter(({ id }) => onboardingStatus.tours[id]?.state === 'completed').length
  const next = ITEMS.find(({ id }) => onboardingStatus.tours[id]?.state !== 'completed')

  return (
    <section className="mb-4 rounded-xl border border-border bg-card p-4" aria-labelledby="getting-started-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary"><Compass className="h-4 w-4" /></div>
          <div><h2 id="getting-started-title" className="text-sm font-semibold">Getting started</h2><p className="mt-1 text-sm text-muted-foreground">{completed} of {ITEMS.length} section tours complete. Pick up where you left off.</p></div>
        </div>
        <Button asChild variant="ghost" size="sm"><Link href="/dashboard/settings?tab=help">View all tours <ChevronRight className="ml-1 h-4 w-4" /></Link></Button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {ITEMS.slice(0, 5).map(({ id, label }) => {
          const isComplete = onboardingStatus.tours[id]?.state === 'completed'
          return <Button key={id} variant={isComplete ? 'outline' : id === next?.id ? 'default' : 'ghost'} size="sm" className="gap-2" onClick={() => startTour(id)}><Check className={isComplete ? 'h-3.5 w-3.5' : 'h-3.5 w-3.5 opacity-30'} />{label}</Button>
        })}
      </div>
    </section>
  )
}
