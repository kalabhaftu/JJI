
export interface AccountFilterSettings {
  showMode: 'active-only' | 'all-accounts' | 'custom'

  selectedAccounts: string[] // Account IDs
  selectedPhaseAccountIds: string[] // Phase account IDs for trade filtering

  includeStatuses: AccountStatus[]

  showLiveAccounts: boolean
  showPropFirmAccounts: boolean

  showPhase1Accounts: boolean
  showPhase2Accounts: boolean
  showFundedAccounts: boolean

  showPassedAccounts: boolean
  showFailedAccounts: boolean

  groupByParentAccount: boolean // Group phase 1 & 2 under parent

  // ✅ NEW: Phase-specific viewing (affects widgets/dashboard, NOT account detail pages)
  viewingSpecificPhase: boolean // If true, user is viewing a specific phase
  selectedMasterAccountId: string | null // Master account ID being viewed
  selectedPhaseId: string | null // Specific phase ID being viewed (null = all phases)
  selectedPhaseNumber: number | null // Phase number for display (1, 2, 3)

  updatedAt: string
}

export type AccountStatus = 'active' | 'failed' | 'funded' | 'passed' | 'pending'

interface AccountHierarchy {
  parentAccountNumber?: string
  parentAccountId?: string
  
  isParentAccount: boolean
  isChildAccount: boolean
  childAccounts: string[] // IDs of related phase accounts
  
  phaseNumber?: 1 | 2
  phaseType?: 'phase_1' | 'phase_2' | 'funded'
}

interface ExtendedAccount {
  id: string
  number: string
  name?: string
  status: AccountStatus
  accountType: 'live' | 'prop-firm'
  propfirm?: string
  broker?: string
  startingBalance: number
  currentBalance?: number
  currentEquity?: number
  hierarchy: AccountHierarchy
  displayName: string
}

export const DEFAULT_FILTER_SETTINGS: AccountFilterSettings = {
  showMode: 'active-only',
  selectedAccounts: [],
  selectedPhaseAccountIds: [],
  includeStatuses: ['active', 'funded'],
  showLiveAccounts: true,
  showPropFirmAccounts: true,
  showPhase1Accounts: true,
  showPhase2Accounts: true,
  showFundedAccounts: true,
  showPassedAccounts: false,
  showFailedAccounts: false,
  groupByParentAccount: true,
  viewingSpecificPhase: false,
  selectedMasterAccountId: null,
  selectedPhaseId: null,
  selectedPhaseNumber: null,
  updatedAt: new Date().toISOString()
}

