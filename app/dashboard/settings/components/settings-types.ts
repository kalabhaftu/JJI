import type { PnlDisplayMode } from '@/lib/metrics/pnl'
import { defaultAiSettings } from './settings-config'

export type SettingsProfileData = {
  firstName: string
  lastName: string
  email: string
  autoAdjustAccountDate: boolean
  breakEvenThreshold: number
  pnlDisplayMode: PnlDisplayMode
  aiSettings: typeof defaultAiSettings
}

export type SettingsSubscriptionData = {
  hasAccess: boolean
  status: string
  reason?: string
  currentPeriodEnd?: string
  nextPaymentDue?: string
  provider?: string
  providerStatus?: string | null
  manageUrl?: string | null
  membershipId?: string | null
  cancelAtPeriodEnd?: boolean
}
