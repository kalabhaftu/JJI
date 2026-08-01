import type { OnboardingStatus } from '@/lib/tours/types'

export function mergeOnboardingStatus(
  current: OnboardingStatus | null,
  update: Partial<OnboardingStatus>,
): OnboardingStatus {
  return {
    core_onboarding_completed: current?.core_onboarding_completed ?? false,
    dashboard_tour_completed: current?.dashboard_tour_completed ?? false,
    analytics_tour_completed: current?.analytics_tour_completed ?? false,
    settings_tour_completed: current?.settings_tour_completed ?? false,
    ...current,
    ...update,
    last_updated: new Date().toISOString(),
  }
}

export async function persistOnboardingStatus(status: OnboardingStatus) {
  const response = await fetch('/api/auth/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ onboardingStatus: status }),
  })
  const result = await response.json()
  if (!response.ok || !result.success) {
    throw new Error('Failed to save onboarding status')
  }
  return result.data ?? null
}
