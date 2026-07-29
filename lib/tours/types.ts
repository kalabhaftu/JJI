export type TourId = 'onboarding' | 'dashboard' | 'analytics' | 'settings'

export interface TourStep {
  id: string
  title: string
  content: string
  targetSelector?: string // If null, renders as centered modal overlay
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center'
  route?: string // Route the user must be on for this step
  actionType?: 'click' | 'input' | 'none' // User action to unlock Next
  actionTarget?: string // Selector that user must interact with
  contrastMessage?: string // Optional contrast explanation ("Why you aren't here")
  desktopOnly?: boolean // Skip this step on mobile
  icon?: string // Optional Lucide icon mapping identifier
}

export interface OnboardingStatus {
  core_onboarding_completed: boolean
  dashboard_tour_completed: boolean
  analytics_tour_completed: boolean
  settings_tour_completed: boolean
  last_updated?: string
}

