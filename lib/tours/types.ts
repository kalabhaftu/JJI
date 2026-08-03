export type TourId =
  | 'onboarding'
  | 'overview'
  | 'accounts'
  | 'trades'
  | 'journal'
  | 'reports'
  | 'playbook'
  | 'backtesting'
  | 'goals'
  | 'assistant'
  | 'data'
  | 'settings'
  | 'dashboard'
  | 'analytics'

export type OnboardingSetupState = 'not_started' | 'in_progress' | 'completed' | 'skipped'
export type OnboardingSetupMode = 'real_import' | 'sample_import'
export type TourProgressState = 'not_started' | 'in_progress' | 'completed' | 'skipped'

export interface TourProgress {
  state: TourProgressState
  currentStepId?: string
  updatedAt?: string
}

export interface TourStep {
  id: string
  title: string
  content: string
  targetSelector?: string
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center'
  route?: string
  completion?: {
    type: 'event' | 'route' | 'selector' | 'value'
    key: string
  }
  contrastMessage?: string
  desktopOnly?: boolean
  icon?: string
}

export interface OnboardingStatus {
  version: 2
  setup: OnboardingSetupState
  setup_mode?: OnboardingSetupMode
  sample_account_id?: string | null
  current_tour?: TourId | null
  current_step_id?: string | null
  tours: Partial<Record<Exclude<TourId, 'onboarding'>, TourProgress>>


  core_onboarding_completed: boolean
  dashboard_tour_completed: boolean
  analytics_tour_completed: boolean
  settings_tour_completed: boolean
  last_updated?: string
}

