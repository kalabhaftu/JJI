import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiRequestData } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/query-keys'
import { useQueryScope, isScopeReady } from '@/lib/query/use-query-scope'
import { useUserStore } from '@/store/user-store'
import { isDemoSurface } from '@/lib/public-surface-routing'
import { reportClientError } from '@/lib/observability/report-error'

const ACCOUNT_STORAGE_KEY = 'dashboard.propFirmWidgets.selectedMasterAccountId'
const RESET_TIMEZONE_STORAGE_KEY = 'dashboard.propFirmWidgets.resetTimezone'
const DEFAULT_RESET_TIMEZONE = 'UTC'

type PhaseSummary = {
  id: string
  phaseNumber: number
  phaseId?: string | null
  status?: string | null
}

export type DashboardPropFirmAccountOption = {
  id: string
  accountName: string
  propFirmName: string
  accountSize: number
  evaluationType: string
  status: string
  currentPhase?: number | null
  PhaseAccount?: PhaseSummary[]
}

const DEMO_ACCOUNTS: DashboardPropFirmAccountOption[] = [
  {
    id: 'mock-propfirm-1',
    accountName: 'Demo Challenge',
    propFirmName: 'FTMO',
    accountSize: 100000,
    evaluationType: 'Two Step',
    status: 'active',
    currentPhase: 1,
    PhaseAccount: [
      { id: 'mock-acc-1', phaseNumber: 1, phaseId: 'FTMO-PHASE-1', status: 'active' }
    ]
  },
  {
    id: 'mock-propfirm-failed',
    accountName: 'Failed Challenge (Old)',
    propFirmName: 'MyForexFunds',
    accountSize: 50000,
    evaluationType: 'Two Step',
    status: 'failed',
    currentPhase: 1,
    PhaseAccount: [
      { id: 'mock-acc-failed', phaseNumber: 1, phaseId: 'OLD-CHALLENGE', status: 'failed' }
    ]
  }
]

function getStoredSelection() {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(ACCOUNT_STORAGE_KEY)
}

function setStoredSelection(value: string) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ACCOUNT_STORAGE_KEY, value)
  window.dispatchEvent(new CustomEvent('prop-firm-widget-account-change', { detail: value }))
}

function getStoredResetTimezone() {
  if (typeof window === 'undefined') return DEFAULT_RESET_TIMEZONE
  return window.localStorage.getItem(RESET_TIMEZONE_STORAGE_KEY) || DEFAULT_RESET_TIMEZONE
}

function setStoredResetTimezone(value: string) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(RESET_TIMEZONE_STORAGE_KEY, value)
  window.dispatchEvent(new CustomEvent('prop-firm-widget-timezone-change', { detail: value }))
}

function getCurrentPhase(account: DashboardPropFirmAccountOption) {
  return account.PhaseAccount?.find((phase) => phase.phaseNumber === account.currentPhase) ?? null
}

const isTrulyActive = (a: DashboardPropFirmAccountOption) => {
  const accountStatus = String(a.status || '').toLowerCase()
  const currentPhase = getCurrentPhase(a)
  const currentPhaseStatus = String(currentPhase?.status || '').toLowerCase()
  return accountStatus === 'active' && currentPhaseStatus === 'active'
}

function isSelectableOrBlownAccount(account: DashboardPropFirmAccountOption) {
  const accountStatus = String(account.status || '').toLowerCase()
  const evaluationType = String(account.evaluationType || '').toLowerCase()

  if (evaluationType.includes('instant')) return false

  if (accountStatus === 'failed') return true

  const currentPhase = getCurrentPhase(account)
  const currentPhaseStatus = String(currentPhase?.status || '').toLowerCase()

  if (currentPhaseStatus === 'failed') return true

  return (
    accountStatus === 'active' &&
    currentPhaseStatus === 'active' &&
    !evaluationType.includes('funded')
  )
}

function getPreferredAccount(accounts: DashboardPropFirmAccountOption[]) {
  return accounts.find(isTrulyActive) ?? accounts[0] ?? null
}

export function useDashboardPropFirmAccount() {
  const user = useUserStore(state => state.user)
  const scope = useQueryScope()
  const isDemo = typeof window !== 'undefined' && isDemoSurface(window.location.hostname, window.location.pathname)

  const query = useQuery({
    queryKey: queryKeys.propFirmAccounts(scope),
    queryFn: ({ signal }) =>
      isDemo
        ? Promise.resolve(DEMO_ACCOUNTS)
        : apiRequestData<DashboardPropFirmAccountOption[]>('/api/v1/prop-firm/accounts', {
            signal,
            operation: 'load-dashboard-prop-firm-accounts',
          }),
    select: (data) => (isDemo ? data : data.filter(isSelectableOrBlownAccount)),
    enabled: isScopeReady(scope) && Boolean(user?.id || isDemo),
    staleTime: 30_000,
  })

  const accounts = useMemo(() => query.data ?? [], [query.data])
  const [selectedMasterAccountId, setSelectedMasterAccountIdState] = useState<string | null>(null)
  const [resetTimezone, setResetTimezoneState] = useState(DEFAULT_RESET_TIMEZONE)

  useEffect(() => {
    if (!query.data) return

    setResetTimezoneState(getStoredResetTimezone())

    const stored = getStoredSelection()
    const storedAccount = stored ? accounts.find(a => a.id === stored) : null
    const isStoredActive = storedAccount && isTrulyActive(storedAccount)

    let preferred: string | null = null
    if (isStoredActive) {
      preferred = stored!
    } else {
      const firstActive = accounts.find(isTrulyActive)
      if (firstActive) {
        preferred = firstActive.id
      } else {
        preferred = storedAccount ? storedAccount.id : (accounts[0]?.id ?? null)
      }
    }

    setSelectedMasterAccountIdState(preferred)
    if (preferred && preferred !== stored) setStoredSelection(preferred)
  }, [query.data, accounts])

  useEffect(() => {
    if (!query.error) return
    reportClientError(query.error, { operation: 'load-dashboard-prop-firm-accounts', route: '/api/v1/prop-firm/accounts' })
  }, [query.error])

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === ACCOUNT_STORAGE_KEY) setSelectedMasterAccountIdState(event.newValue)
      if (event.key === RESET_TIMEZONE_STORAGE_KEY) setResetTimezoneState(event.newValue || DEFAULT_RESET_TIMEZONE)
    }
    const handleCustom = (event: Event) => {
      setSelectedMasterAccountIdState((event as CustomEvent<string>).detail)
    }
    const handleTimezoneCustom = (event: Event) => {
      setResetTimezoneState((event as CustomEvent<string>).detail || DEFAULT_RESET_TIMEZONE)
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener('prop-firm-widget-account-change', handleCustom)
    window.addEventListener('prop-firm-widget-timezone-change', handleTimezoneCustom)

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('prop-firm-widget-account-change', handleCustom)
      window.removeEventListener('prop-firm-widget-timezone-change', handleTimezoneCustom)
    }
  }, [])

  const setSelectedMasterAccountId = useCallback((value: string) => {
    setSelectedMasterAccountIdState(value)
    setStoredSelection(value)
  }, [])

  const setResetTimezone = useCallback((value: string) => {
    setResetTimezoneState(value)
    setStoredResetTimezone(value)
  }, [])

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedMasterAccountId) ?? null,
    [accounts, selectedMasterAccountId]
  )

  return {
    accounts,
    selectedAccount,
    selectedMasterAccountId,
    setSelectedMasterAccountId,
    resetTimezone,
    setResetTimezone,
    isLoading: query.isPending,
    error: query.error instanceof Error ? query.error.message : null,
  }
}
