import { describe, expect, it } from 'vitest'

import {
  DEFAULT_ONBOARDING_STATUS,
  normalizeOnboardingStatus,
  updateTourProgress,
} from '@/lib/tours/persistence'

describe('onboarding status persistence', () => {
  it('migrates a legacy first connection into the canonical setup state', () => {
    expect(normalizeOnboardingStatus(null, true).setup).toBe('not_started')
    expect(normalizeOnboardingStatus(null, false).setup).toBe('completed')
  })

  it('preserves a stored status while filling the current mirrors', () => {
    const status = normalizeOnboardingStatus({
      version: 1,
      setup: 'completed',
      tours: { overview: { state: 'completed' } },
    }, true)

    expect(status.version).toBe(2)
    expect(status.setup).toBe('completed')
    expect(status.dashboard_tour_completed).toBe(true)
    expect(status.core_onboarding_completed).toBe(true)
  })

  it('stores resumable step state and never rewinds another tour', () => {
    const status = updateTourProgress(DEFAULT_ONBOARDING_STATUS, 'reports', 'in_progress', 'reports-spreadsheet')

    expect(status.current_tour).toBe('reports')
    expect(status.current_step_id).toBe('reports-spreadsheet')
    expect(status.tours.reports).toMatchObject({
      state: 'in_progress',
      currentStepId: 'reports-spreadsheet',
    })

    const completed = updateTourProgress(status, 'reports', 'completed')
    expect(completed.current_tour).toBeNull()
    expect(completed.tours.reports?.state).toBe('completed')
    expect(completed.analytics_tour_completed).toBe(true)
  })
})
