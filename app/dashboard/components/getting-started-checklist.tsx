'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, ChevronRight, Compass, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTour } from '@/context/tour-context'
import type { TourId } from '@/lib/tours/types'

const CHECKLIST_DISMISSED_KEY = 'jji_checklist_dismissed'

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
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(CHECKLIST_DISMISSED_KEY) === '1')
    } catch {
      setDismissed(false)
    }
  }, [])

  if (!onboardingStatus || onboardingStatus.setup !== 'not_started' || activeTour || dismissed) return null

  const dismiss = () => {
    try {
      localStorage.setItem(CHECKLIST_DISMISSED_KEY, '1')
    } catch {
      // ignore
    }
    setDismissed(true)
  }

  const completed = ITEMS.filter(({ id }) => onboardingStatus.tours[id]?.state === 'completed').length
  const next = ITEMS.find(({ id }) => onboardingStatus.tours[id]?.state !== 'completed')

  return (
    <section className="mb-4 rounded-xl border border-border bg-card p-4" aria-labelledby="getting-started-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary"><Compass className="h-4 w-4" /></div>
          <div><h2 id="getting-started-title" className="text-sm font-semibold">Getting started</h2><p className="mt-1 text-sm text-muted-foreground">Complete the section tours to set up your workspace.</p></div>
        </div>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm"><Link href="/dashboard/settings?tab=help">View all tours <ChevronRight className="ml-1 h-4 w-4" /></Link></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={dismiss} aria-label="Dismiss getting started checklist"><X className="h-4 w-4" /></Button>
        </div>
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
