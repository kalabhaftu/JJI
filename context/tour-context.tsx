'use client'

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useUserStore } from '@/store/user-store'
import { toast } from 'sonner'
import { useData } from '@/context/data-provider'
import { clearAccountsCache } from '@/hooks/use-accounts'
import { reportError } from '@/lib/observability/report-error'
import {
  useTourAccountCreatedEvent,
  useTourActionAdvance,
  useTourTargetVisibility,
} from '@/hooks/use-tour-interactions'

import { TOURS } from '@/lib/tours/definitions'
import { mergeOnboardingStatus, persistOnboardingStatus } from '@/lib/tours/persistence'
import { downloadSampleTradesCsv } from '@/lib/tours/sample-csv'
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

    const nextStatus = mergeOnboardingStatus(onboardingStatus, updatedStatus)
    setOnboardingStatus(nextStatus)

    try {
      const updatedUser = await persistOnboardingStatus(nextStatus)
      if (updatedUser) setDbUser(updatedUser)
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

  const pauseTour = useCallback(() => {
    setPaused(true)
  }, [])

  const resumeTour = useCallback(() => {
    setPaused(false)
    if (currentStep?.route && pathname !== currentStep.route) {
      router.push(currentStep.route as any)
    }
  }, [currentStep, pathname, router])

  useTourAccountCreatedEvent({
    createdAccountId,
    currentStep,
    nextStep,
    setCreatedAccountId,
    setCreatedAccountType,
  })

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
        try {
          downloadSampleTradesCsv()
          toast.success('Sample CSV file downloaded successfully!')
        } catch (error) {
          reportError(error, {
            surface: 'client',
            operation: 'generate-onboarding-sample-csv',
          })
        }
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [activeTour, currentStep])

  const navigateForTour = useCallback((route: string) => {
    router.push(route as any)
  }, [router])
  const { isTargetVisible, isLoadingTarget } = useTourTargetVisibility({
    activeTour,
    currentStep,
    paused,
    pathname,
    isMobile,
    stepIndex,
    navigate: navigateForTour,
    nextStep,
    prevStep,
    pauseTour,
  })
  useTourActionAdvance({
    activeTour,
    currentStep,
    paused,
    isTargetVisible,
    nextStep,
  })

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
