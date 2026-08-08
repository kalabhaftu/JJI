import { apiRequestData } from '@/lib/api/client'
import type { OnboardingStatus, TourId, TourProgress, TourProgressState } from '@/lib/tours/types'

const TOUR_MIRRORS: Partial<Record<TourId, keyof OnboardingStatus>> = {
  onboarding: 'core_onboarding_completed',
  overview: 'dashboard_tour_completed',
  reports: 'analytics_tour_completed',
  settings: 'settings_tour_completed',
}

export const DEFAULT_ONBOARDING_STATUS: OnboardingStatus = {
  version: 2,
  setup: 'not_started',
  sample_account_id: null,
  current_tour: null,
  current_step_id: null,
  tours: {},
  core_onboarding_completed: false,
  dashboard_tour_completed: false,
  analytics_tour_completed: false,
  settings_tour_completed: false,
}

export function normalizeOnboardingStatus(
  raw: unknown,
  legacyFirstConnection = false,
): OnboardingStatus {
  const hasStoredStatus = Boolean(raw && typeof raw === 'object')
  const source = hasStoredStatus ? raw as Partial<OnboardingStatus> : {}
  const legacyCompleted = Boolean(source.core_onboarding_completed)
  const setup = source.setup ?? (
    hasStoredStatus
      ? (legacyFirstConnection || !legacyCompleted ? 'not_started' : 'completed')
      : (legacyFirstConnection ? 'not_started' : 'completed')
  )
  const tours = { ...(source.tours ?? {}) }

  for (const [tourId, mirror] of Object.entries(TOUR_MIRRORS)) {
    const completed = Boolean(source[mirror!])
    if (!tours[tourId as Exclude<TourId, 'onboarding'>] && completed) {
      tours[tourId as Exclude<TourId, 'onboarding'>] = {
        state: 'completed',
        ...(source.last_updated ? { updatedAt: source.last_updated } : {}),
      }
    }
  }

  return {
    ...DEFAULT_ONBOARDING_STATUS,
    ...source,
    version: 2,
    setup,
    tours,
    core_onboarding_completed: setup === 'completed' || setup === 'skipped',
    dashboard_tour_completed: tours.overview?.state === 'completed' || Boolean(source.dashboard_tour_completed),
    analytics_tour_completed: tours.reports?.state === 'completed' || Boolean(source.analytics_tour_completed),
    settings_tour_completed: tours.settings?.state === 'completed' || Boolean(source.settings_tour_completed),
  }
}

export function mergeOnboardingStatus(
  current: OnboardingStatus | null,
  update: Partial<OnboardingStatus>,
): OnboardingStatus {
  const base = normalizeOnboardingStatus(current)
  const next = {
    ...base,
    ...update,
    tours: { ...base.tours, ...(update.tours ?? {}) },
    last_updated: new Date().toISOString(),
  }

  return normalizeOnboardingStatus(next)
}

export function updateTourProgress(
  current: OnboardingStatus | null,
  tourId: Exclude<TourId, 'onboarding'>,
  state: TourProgressState,
  currentStepId?: string,
): OnboardingStatus {
  const progress: TourProgress = {
    state,
    ...(currentStepId ? { currentStepId } : {}),
    updatedAt: new Date().toISOString(),
  }
  const mirror = TOUR_MIRRORS[tourId]
  return mergeOnboardingStatus(current, {
    current_tour: state === 'in_progress' ? tourId : null,
    current_step_id: currentStepId ?? null,
    tours: { [tourId]: progress },
    ...(mirror ? { [mirror]: state === 'completed' } : {}),
  })
}

export async function persistOnboardingStatus(status: OnboardingStatus) {
  const data = await apiRequestData<any>('/api/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify({ onboardingStatus: status }),
  })
  return data ?? null
}
