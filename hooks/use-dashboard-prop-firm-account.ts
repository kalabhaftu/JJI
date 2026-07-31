import { useCallback, useEffect, useMemo, useState } from 'react'
import { useUserStore } from '@/store/user-store'

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

  // Always exclude instant accounts
  if (evaluationType.includes('instant')) return false

  // Allow blown/failed master accounts
  if (accountStatus === 'failed') return true

  const currentPhase = getCurrentPhase(account)
  const currentPhaseStatus = String(currentPhase?.status || '').toLowerCase()

  // Allow accounts where the current phase has failed/blown
  if (currentPhaseStatus === 'failed') return true

  // For active accounts, must have active current phase and not be funded
  return (
    accountStatus === 'active' &&
    currentPhaseStatus === 'active' &&
    !evaluationType.includes('funded')
  )
}

function getPreferredAccount(accounts: DashboardPropFirmAccountOption[]) {
  // Prefer the first active account, fallback to first in list
  return accounts.find(isTrulyActive) ?? accounts[0] ?? null
}

export function useDashboardPropFirmAccount() {
  const user = useUserStore(state => state.user)
  const isDemo = typeof window !== 'undefined' && window.location.pathname.startsWith('/demo')

  const [accounts, setAccounts] = useState<DashboardPropFirmAccountOption[]>([])
  const [selectedMasterAccountId, setSelectedMasterAccountIdState] = useState<string | null>(null)
  const [resetTimezone, setResetTimezoneState] = useState(DEFAULT_RESET_TIMEZONE)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadAccounts() {
      setIsLoading(true)
      setError(null)
      try {
        if (isDemo) {
          const nextAccounts = [
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
          
          if (cancelled) return
          setAccounts(nextAccounts)
          setResetTimezoneState(getStoredResetTimezone())
          
          const stored = getStoredSelection()
          const storedAccount = stored ? nextAccounts.find(a => a.id === stored) : null
          const isStoredActive = storedAccount && isTrulyActive(storedAccount)
          
          let preferred: string | null = null
          if (isStoredActive) {
            preferred = stored!
          } else {
            const firstActive = nextAccounts.find(isTrulyActive)
            if (firstActive) {
              preferred = firstActive.id
            } else {
              preferred = storedAccount ? storedAccount.id : (nextAccounts[0]?.id ?? null)
            }
          }
          
          setSelectedMasterAccountIdState(preferred)
          if (preferred && preferred !== stored) setStoredSelection(preferred)
          return
        }

        const response = await fetch('/api/v1/prop-firm/accounts')
        const payload = await response.json()
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || 'Failed to load prop firm accounts')
        }

        const nextAccounts: DashboardPropFirmAccountOption[] = (Array.isArray(payload.data) ? payload.data : []).filter(isSelectableOrBlownAccount)
        if (cancelled) return

        setAccounts(nextAccounts)
        setResetTimezoneState(getStoredResetTimezone())
        
        const stored = getStoredSelection()
        const storedAccount = stored ? nextAccounts.find(a => a.id === stored) : null
        const isStoredActive = storedAccount && isTrulyActive(storedAccount)
        
        let preferred: string | null = null
        if (isStoredActive) {
          preferred = stored!
        } else {
          const firstActive = nextAccounts.find(isTrulyActive)
          if (firstActive) {
            preferred = firstActive.id
          } else {
            preferred = storedAccount ? storedAccount.id : (nextAccounts[0]?.id ?? null)
          }
        }
        
        setSelectedMasterAccountIdState(preferred)
        if (preferred && preferred !== stored) setStoredSelection(preferred)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load prop firm accounts')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    loadAccounts()

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
      cancelled = true
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('prop-firm-widget-account-change', handleCustom)
      window.removeEventListener('prop-firm-widget-timezone-change', handleTimezoneCustom)
    }
  }, [isDemo])

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
    isLoading,
    error,
  }
}
