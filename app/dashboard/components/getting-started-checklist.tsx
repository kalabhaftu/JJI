'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { HugeiconsIcon } from '@hugeicons/react'
import { Tick01Icon, ChevronRightIcon, Compass01Icon, Cancel01Icon } from '@hugeicons/core-free-icons'
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

    }
    setDismissed(true)
  }

  const completed = ITEMS.filter(({ id }) => onboardingStatus.tours[id]?.state === 'completed').length
  const next = ITEMS.find(({ id }) => onboardingStatus.tours[id]?.state !== 'completed')

  return (
    <section className="mb-4 rounded-xl border border-border bg-card p-4" aria-labelledby="getting-started-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary"><HugeiconsIcon icon={Compass01Icon} className="h-4 w-4" strokeWidth={1.5} color="currentColor" /></div>
          <div><h2 id="getting-started-title" className="text-sm font-semibold">Getting started</h2><p className="mt-1 text-sm text-muted-foreground">Complete the section tours to set up your workspace.</p></div>
        </div>
        <div className="flex items-center gap-1">
          <Button asChild variant="tertiary" size="sm"><Link href="/dashboard/settings?tab=help">View all tours <HugeiconsIcon icon={ChevronRightIcon} className="ml-1 h-4 w-4" strokeWidth={1.5} color="currentColor" /></Link></Button>
          <Button variant="icon-only" size="icon" className="h-11 w-11" onClick={dismiss} aria-label="Dismiss getting started checklist"><HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" strokeWidth={1.5} color="currentColor" /></Button>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {ITEMS.slice(0, 5).map(({ id, label }) => {
          const isComplete = onboardingStatus.tours[id]?.state === 'completed'
          return <Button key={id} variant={isComplete ? "secondary" : id === next?.id ? "primary" : "tertiary"} size="sm" className="gap-2" onClick={() => startTour(id)}><HugeiconsIcon icon={Tick01Icon} className={isComplete ? 'h-3.5 w-3.5' : 'h-3.5 w-3.5 opacity-30'} strokeWidth={1.5} color="currentColor" />{label}</Button>
        })}
      </div>
    </section>
  )
}
