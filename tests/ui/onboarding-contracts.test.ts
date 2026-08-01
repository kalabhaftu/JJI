import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { TOURS } from '@/lib/tours/definitions'

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('onboarding UX contracts', () => {
  it('mounts one onboarding shell and removes the competing modal path', () => {
    const modals = source('components/modals.tsx')
    expect(modals).toContain('<OnboardingShell />')
    expect(modals).not.toContain('OnboardingModal')
    expect(modals).not.toContain('No Trades Found')
    expect(existsSync(resolve(process.cwd(), 'components/onboarding-modal.tsx'))).toBe(false)
  })

  it('keeps the no-account import state actionable', () => {
    const importSelection = source('app/dashboard/components/import/account-selection.tsx')
    expect(importSelection).toContain('Create trading account')
    expect(importSelection).toContain('/dashboard/accounts')
    const emptyTrades = source('app/dashboard/components/empty-trade-state.tsx')
    expect(emptyTrades).toContain('Create a trading account first')
    expect(emptyTrades).toContain('Your workspace has no trades yet')
    expect(emptyTrades).toContain('No trades in this account scope')
  })

  it('covers the requested product areas with short resumable tours', () => {
    const requiredTours = ['overview', 'accounts', 'trades', 'journal', 'reports', 'playbook', 'backtesting', 'goals', 'assistant', 'data', 'settings'] as const
    for (const tourId of requiredTours) {
      expect(TOURS[tourId].length, tourId).toBeGreaterThanOrEqual(2)
      expect(TOURS[tourId].length, tourId).toBeLessThanOrEqual(7)
    }
    expect(source('app/dashboard/components/getting-started-checklist.tsx')).toContain('startTour')
    expect(source('app/dashboard/settings/components/settings-help-section.tsx')).toContain('Start')
  })

  it('protects sample workspace cleanup by owner and marker', () => {
    const lifecycle = source('server/accounts/lifecycle.ts')
    expect(lifecycle).toContain('isOnboardingSample, true')
    expect(lifecycle).toContain('eq(table.userId, userId)')
    expect(lifecycle).toContain('tx.delete(schema.Trade)')
    expect(source('app/api/v1/onboarding/sample-workspace/route.ts')).toContain("applyApiRoutePolicy(request, 'sensitive')")
  })

  it('uses semantic tour events and missing-target recovery', () => {
    expect(source('hooks/use-tour-interactions.ts')).toContain('TOUR_EVENT')
    expect(source('components/tour/tour-tooltip.tsx')).toContain('Retry')
    expect(source('components/tour/tour-tooltip.tsx')).toContain('skip this step')
    expect(source('app/dashboard/reports/components/reports-navigation.tsx')).toContain('reports.tab.')
  })
})
