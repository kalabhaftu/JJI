'use client'

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useUserStore } from '@/store/user-store'
import { toast } from 'sonner'
import { useData } from '@/context/data-provider'
import { clearAccountsCache } from '@/hooks/use-accounts'
import { reportError } from '@/lib/observability/report-error'

import { TOURS } from '@/lib/tours/definitions'
import type { OnboardingStatus, TourId, TourStep } from '@/lib/tours/types'

interface TourContextType {
  activeTour: TourId | null
  stepIndex: number
  currentStep: TourStep | null
  paused: boolean
  onboardingStatus: OnboardingStatus | null
  startTour: (tourId: TourId) => void
  nextStep: () => void
  prevStep: () => void
  skipTour: () => void
  completeTour: () => void
  resumeTour: () => void
  pauseTour: () => void
  isTargetVisible: boolean
  isLoadingTarget: boolean
  totalSteps: number
}

const TourContext = createContext<TourContextType | undefined>(undefined)

const DEFAULT_ONBOARDING_STATUS: OnboardingStatus = {
  core_onboarding_completed: false,
  dashboard_tour_completed: false,
  analytics_tour_completed: false,
  settings_tour_completed: false,
}

export const TourProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter()
  const pathname = usePathname()
  const storeUser = useUserStore((state) => state.user)
  const setDbUser = useUserStore((state) => state.setUser)
  const isMobile = useUserStore((state) => state.isMobile)
  const { accounts } = useData()

  const [activeTour, setActiveTour] = useState<TourId | null>(null)
  const [stepIndex, setStepIndex] = useState<number>(0)
  const [paused, setPaused] = useState<boolean>(false)
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null)
  const [isTargetVisible, setIsTargetVisible] = useState<boolean>(false)
  const [isLoadingTarget, setIsLoadingTarget] = useState<boolean>(false)

  const targetCheckInterval = useRef<NodeJS.Timeout | null>(null)
  const targetTimeout = useRef<NodeJS.Timeout | null>(null)

  // Track the created demo account during the onboarding tour
  const initialAccountIds = useRef<string[]>([])
  const [createdAccountId, setCreatedAccountId] = useState<string | null>(null)
  const [createdAccountType, setCreatedAccountType] = useState<'live' | 'prop-firm' | null>(null)

  const currentSteps = activeTour ? TOURS[activeTour] : []
  const currentStep = activeTour && currentSteps[stepIndex] ? currentSteps[stepIndex] : null

  // Fetch onboarding status from Zustand store / User data
  useEffect(() => {
    if (storeUser) {
      const dbStatus = (storeUser as any).onboardingStatus
      if (dbStatus && typeof dbStatus === 'object') {
        setOnboardingStatus({
          core_onboarding_completed: !!dbStatus.core_onboarding_completed,
          dashboard_tour_completed: !!dbStatus.dashboard_tour_completed,
          analytics_tour_completed: !!dbStatus.analytics_tour_completed,
          settings_tour_completed: !!dbStatus.settings_tour_completed,
          last_updated: dbStatus.last_updated,
        })
      } else {
        setOnboardingStatus(DEFAULT_ONBOARDING_STATUS)
      }
    }
  }, [storeUser])

  // Action methods
  const startTour = useCallback((tourId: TourId) => {
    setActiveTour(tourId)
    setStepIndex(0)
    setPaused(false)
    if (tourId === 'onboarding') {
      setCreatedAccountId(null)
      setCreatedAccountType(null)
      initialAccountIds.current = accounts ? accounts.map((a: any) => a.id) : []
    }
  }, [accounts])

  // Automatically trigger onboarding for new users on main dashboard page
  useEffect(() => {
    if (
      onboardingStatus &&
      onboardingStatus.core_onboarding_completed === false &&
      activeTour === null &&
      pathname === '/dashboard' &&
      !paused
    ) {
      const timer = setTimeout(() => {
        startTour('onboarding')
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [onboardingStatus, activeTour, pathname, paused, startTour])

  // Save onboarding status to DB
  const saveOnboardingStatus = useCallback(async (updatedStatus: Partial<OnboardingStatus>) => {
    if (!storeUser) return

    const nextStatus = {
      ...onboardingStatus,
      ...updatedStatus,
      last_updated: new Date().toISOString(),
    }

    setOnboardingStatus(nextStatus as OnboardingStatus)

    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboardingStatus: nextStatus }),
      })
      const result = await response.json()
      if (result.success && result.data) {
        setDbUser(result.data)
      }
    } catch (error) {
      reportError(error, {
        surface: 'client',
        operation: 'save-tour-status',
        route: '/api/auth/profile',
      })
    }
  }, [storeUser, onboardingStatus, setDbUser])

  const skipTour = async () => {
    if (!activeTour) return

    const keyMap: Record<TourId, keyof OnboardingStatus> = {
      onboarding: 'core_onboarding_completed',
      dashboard: 'dashboard_tour_completed',
      analytics: 'analytics_tour_completed',
      settings: 'settings_tour_completed',
    }

    // Clean up created demo account on skip
    if (activeTour === 'onboarding' && createdAccountId) {
      try {
        const endpoint = createdAccountType === 'prop-firm'
          ? `/api/v1/prop-firm/accounts/${createdAccountId}`
          : `/api/v1/accounts/${createdAccountId}`

        await fetch(endpoint, { method: 'DELETE' })
        clearAccountsCache()
      } catch (error) {
        reportError(error, {
          surface: 'client',
          operation: 'delete-onboarding-account-on-skip',
        })
      }
    }

    saveOnboardingStatus({ [keyMap[activeTour]]: true })
    setActiveTour(null)
    setPaused(false)
    toast.success('Tour skipped. You can restart it anytime from settings.')
  }

  const completeTour = useCallback(async () => {
    if (!activeTour) return

    const keyMap: Record<TourId, keyof OnboardingStatus> = {
      onboarding: 'core_onboarding_completed',
      dashboard: 'dashboard_tour_completed',
      analytics: 'analytics_tour_completed',
      settings: 'settings_tour_completed',
    }

    // Clean up created demo account on complete
    if (activeTour === 'onboarding' && createdAccountId) {
      const toastId = toast.loading('Completing onboarding and cleaning up demo portfolio...')
      try {
        const endpoint = createdAccountType === 'prop-firm'
          ? `/api/v1/prop-firm/accounts/${createdAccountId}`
          : `/api/v1/accounts/${createdAccountId}`

        const response = await fetch(endpoint, { method: 'DELETE' })
        if (response.ok) {
          clearAccountsCache()
          toast.success('Demo account deleted to keep workspace clean!', { id: toastId })
        } else {
          toast.error('Failed to clean up demo account.', { id: toastId })
        }
      } catch (error) {
        reportError(error, {
          surface: 'client',
          operation: 'delete-onboarding-account-on-complete',
        })
        toast.error('Error cleaning up demo account.', { id: toastId })
      }
    }

    saveOnboardingStatus({ [keyMap[activeTour]]: true })
    setActiveTour(null)
    setPaused(false)

    if (activeTour === 'onboarding') {
      router.push('/dashboard')
    } else {
      toast.success('Tour completed.')
    }
  }, [activeTour, createdAccountId, createdAccountType, router, saveOnboardingStatus])

  const nextStep = useCallback(() => {
    if (!activeTour) return

    if (stepIndex < currentSteps.length - 1) {
      setStepIndex((prev) => prev + 1)
    } else {
      completeTour()
    }
  }, [activeTour, stepIndex, currentSteps.length, completeTour])

  const prevStep = useCallback(() => {
    if (stepIndex > 0) {
      setStepIndex((prev) => prev - 1)
    }
  }, [stepIndex])

  const pauseTour = () => {
    setPaused(true)
  }

  const resumeTour = () => {
    setPaused(false)
    if (currentStep?.route && pathname !== currentStep.route) {
      router.push(currentStep.route as any)
    }
  }

  // Listen for the custom account-created event (instant detection)
  useEffect(() => {
    const handleAccountCreated = (e: Event) => {
      const customEvent = e as CustomEvent
      const { id, type } = customEvent.detail || {}
      if (id && type && !createdAccountId) {
        setCreatedAccountId(id)
        setCreatedAccountType(type)
        
        // Auto-advance if we are on the submit-account step
        if (currentStep?.id === 'submit-account') {
          nextStep()
        }
      }
    }

    document.addEventListener('jji-account-created', handleAccountCreated)
    return () => {
      document.removeEventListener('jji-account-created', handleAccountCreated)
    }
  }, [createdAccountId, currentStep, nextStep])

  // Fallback: Detect newly created account in onboarding via list diffing
  useEffect(() => {
    if (activeTour === 'onboarding' && accounts && accounts.length > 0) {
      const newAcc = accounts.find((a: any) => !initialAccountIds.current.includes(a.id))
      if (newAcc && !createdAccountId) {
        setCreatedAccountId(newAcc.id)
        setCreatedAccountType(newAcc.accountType || 'live')
        
        // Auto-advance if we are on the submit-account step
        if (currentStep?.id === 'submit-account') {
          nextStep()
        }
      }
    }
  }, [accounts, activeTour, createdAccountId, currentStep, nextStep])

  // Trigger sample CSV download automatically on the csv-download step
  useEffect(() => {
    if (activeTour === 'onboarding' && currentStep?.id === 'csv-download') {
      const timer = setTimeout(() => {
        downloadSampleCSV()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [activeTour, currentStep])

  const downloadSampleCSV = () => {
    try {
      const headers = ["Symbol", "Side", "Quantity", "Entry Price", "Close Price", "Entry Date", "Close Date", "PnL"]
      const rows = [
        ["EURUSD", "Buy", "1.0", "1.0850", "1.0900", "2026-06-08 09:00:00", "2026-06-08 10:00:00", "500.00"],
        ["GBPUSD", "Sell", "1.5", "1.2650", "1.2600", "2026-06-08 10:30:00", "2026-06-08 12:00:00", "750.00"],
        ["USDJPY", "Buy", "2.0", "155.20", "154.80", "2026-06-08 13:00:00", "2026-06-08 14:15:00", "-800.00"]
      ]
      const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n")
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.setAttribute("href", url)
      link.setAttribute("download", "sample_trades.csv")
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast.success("Sample CSV file downloaded successfully!")
    } catch (e) {
      reportError(e, {
        surface: 'client',
        operation: 'generate-onboarding-sample-csv',
      })
    }
  }

  // Handle route and target visibility checks for the active step
  useEffect(() => {
    if (!activeTour || !currentStep || paused) {
      setIsTargetVisible(false)
      setIsLoadingTarget(false)
      return
    }

    // Check if we need to route to a different page
    if (currentStep.route && pathname !== currentStep.route) {
      setIsLoadingTarget(true)
      router.push(currentStep.route as any)
      return
    }

    // Check if the step is desktop-only and we are on mobile
    if (currentStep.desktopOnly && isMobile) {
      nextStep()
      return
    }

    // If step has no target selector, it's a modal
    if (!currentStep.targetSelector) {
      setIsTargetVisible(true)
      setIsLoadingTarget(false)
      return
    }

    setIsTargetVisible(false)
    setIsLoadingTarget(true)

    // Clear previous check timers
    if (targetCheckInterval.current) clearInterval(targetCheckInterval.current)
    if (targetTimeout.current) clearTimeout(targetTimeout.current)

    // Poll for the target element to handle rendering delays / network loading
    let attempts = 0
    targetCheckInterval.current = setInterval(() => {
      const el = document.querySelector(currentStep.targetSelector!)
      attempts++

      if (el) {
        setIsTargetVisible(true)
        setIsLoadingTarget(false)
        clearInterval(targetCheckInterval.current!)
        targetCheckInterval.current = null
      } else if (attempts >= 15) {
        clearInterval(targetCheckInterval.current!)
        targetCheckInterval.current = null
        setIsLoadingTarget(false)
        if (stepIndex > 0) {
          prevStep()
          toast.info('Dropdown closed or target not found. Rewinding one step. Please click the trigger again to continue the tour.', { duration: 4000 })
        } else {
          pauseTour()
          toast.info('Tour paused. Click the resume widget to continue when ready.', { duration: 4000 })
        }
      }
    }, 500)

    return () => {
      if (targetCheckInterval.current) clearInterval(targetCheckInterval.current)
    }
  }, [activeTour, stepIndex, pathname, paused, isMobile, currentStep, nextStep, prevStep, router])

  // Setup interactive listeners if step requires real user interaction (using Capture Phase listeners to bypass Radix event prevention)
  useEffect(() => {
    if (!activeTour || !currentStep || paused || !isTargetVisible) return

    const { actionType, actionTarget } = currentStep
    if (!actionType || !actionTarget) return

    let actionFired = false
    const handleAction = () => {
      if (actionFired) return
      actionFired = true
      setTimeout(() => {
        nextStep()
      }, 305)
    }

    const handleCaptureAction = (e: Event) => {
      if (actionFired) return
      const target = e.target as Element | null
      if (target) {
        // Match target itself or closest ancestor matching the selector
        const matched = target.closest(actionTarget)
        if (matched) {
          handleAction()
        }
      }
    }

    if (actionType === 'click') {
      document.addEventListener('click', handleCaptureAction, { capture: true })
      document.addEventListener('mousedown', handleCaptureAction, { capture: true })
      document.addEventListener('pointerdown', handleCaptureAction, { capture: true })
    } else if (actionType === 'input') {
      document.addEventListener('input', handleCaptureAction, { capture: true })
    }

    return () => {
      if (actionType === 'click') {
        document.removeEventListener('click', handleCaptureAction, { capture: true })
        document.removeEventListener('mousedown', handleCaptureAction, { capture: true })
        document.removeEventListener('pointerdown', handleCaptureAction, { capture: true })
      } else if (actionType === 'input') {
        document.removeEventListener('input', handleCaptureAction, { capture: true })
      }
    }
  }, [activeTour, stepIndex, isTargetVisible, paused, currentStep, nextStep])


  return (
    <TourContext.Provider
      value={{
        activeTour,
        stepIndex,
        currentStep,
        paused,
        onboardingStatus,
        startTour,
        nextStep,
        prevStep,
        skipTour,
        completeTour,
        resumeTour,
        pauseTour,
        isTargetVisible,
        isLoadingTarget,
        totalSteps: currentSteps.length,
      }}
    >
      {children}
    </TourContext.Provider>
  )
}

export const useTour = () => {
  const context = useContext(TourContext)
  if (context === undefined) {
    throw new Error('useTour must be used within a TourProvider')
  }
  return context
}
