'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { Route } from 'next'
import { toast } from 'sonner'
import { useUserStore } from '@/store/user-store'
import { clearAccountsCache } from '@/hooks/use-accounts'
import { reportError } from '@/lib/observability/report-error'
import { TOURS } from '@/lib/tours/definitions'
import {
  mergeOnboardingStatus,
  normalizeOnboardingStatus,
  persistOnboardingStatus,
  updateTourProgress,
} from '@/lib/tours/persistence'
import type { OnboardingSetupMode, OnboardingStatus, TourId, TourStep } from '@/lib/tours/types'
import {
  useTourActionAdvance,
  useTourTargetVisibility,
} from '@/hooks/use-tour-interactions'

interface TourContextType {
  activeTour: TourId | null
  stepIndex: number
  currentStep: TourStep | null
  paused: boolean
  onboardingStatus: OnboardingStatus | null
  onboardingOpen: boolean
  cleanupError: string | null
  startTour: (tourId: TourId) => void
  startSetup: () => void
  setSetupMode: (mode: OnboardingSetupMode) => void
  setSampleAccountId: (accountId: string | null) => Promise<void>
  completeSetup: (mode: OnboardingSetupMode, sampleAccountId?: string | null) => Promise<void>
  skipSetup: () => Promise<void>
  nextStep: () => void
  prevStep: () => void
  skipTour: () => Promise<void>
  completeTour: () => Promise<void>
  resumeTour: () => void
  pauseTour: () => void
  retryTarget: () => void
  retrySampleCleanup: () => Promise<void>
  isTargetVisible: boolean
  isLoadingTarget: boolean
  targetMissing: boolean
  totalSteps: number
}

const TourContext = createContext<TourContextType | undefined>(undefined)

function canonicalTourId(tourId: TourId): TourId {
  if (tourId === 'dashboard') return 'overview'
  if (tourId === 'analytics') return 'reports'
  return tourId
}

export const TourProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter()
  const pathname = usePathname()
  const storeUser = useUserStore((state) => state.user)
  const setDbUser = useUserStore((state) => state.setUser)
  const isMobile = useUserStore((state) => state.isMobile)

  const [activeTour, setActiveTour] = useState<TourId | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null)
  const [cleanupError, setCleanupError] = useState<string | null>(null)

  const currentSteps = useMemo(() => activeTour ? TOURS[activeTour] : [], [activeTour])
  const currentStep = activeTour && currentSteps[stepIndex] ? currentSteps[stepIndex] : null

  useEffect(() => {
    if (!storeUser) {
      setOnboardingStatus(null)
      return
    }

    const rawStatus = (storeUser as any).onboardingStatus
    const normalized = normalizeOnboardingStatus(rawStatus, Boolean(storeUser.isFirstConnection))
    setOnboardingStatus(normalized)
    if (!rawStatus) {
      void persistOnboardingStatus(normalized)
        .then((updatedUser) => { if (updatedUser) setDbUser(updatedUser) })
        .catch((error) => reportError(error, { surface: 'client', operation: 'migrate-onboarding-status', route: '/api/auth/profile' }))
    }
  }, [setDbUser, storeUser])

  const saveOnboardingStatus = useCallback(async (update: Partial<OnboardingStatus>) => {
    if (!storeUser) return
    const nextStatus = mergeOnboardingStatus(onboardingStatus, update)
    setOnboardingStatus(nextStatus)

    try {
      const updatedUser = await persistOnboardingStatus(nextStatus)
      if (updatedUser) setDbUser(updatedUser)
    } catch (error) {
      reportError(error, { surface: 'client', operation: 'save-tour-status', route: '/api/auth/profile' })
    }
  }, [onboardingStatus, setDbUser, storeUser])

  const startTour = useCallback((requestedTourId: TourId) => {
    const tourId = canonicalTourId(requestedTourId)
    if (!TOURS[tourId]?.length) return
    const savedStepId = onboardingStatus?.tours[tourId as keyof typeof onboardingStatus.tours]?.currentStepId
    const savedIndex = savedStepId ? TOURS[tourId].findIndex((step) => step.id === savedStepId) : -1
    setActiveTour(tourId)
    setStepIndex(savedIndex >= 0 ? savedIndex : 0)
    setPaused(false)
    setCleanupError(null)
    void saveOnboardingStatus({
      current_tour: tourId,
      current_step_id: savedIndex >= 0 ? TOURS[tourId][savedIndex]?.id ?? null : TOURS[tourId][0]?.id ?? null,
      tours: {
        [tourId]: {
          state: 'in_progress',
          currentStepId: savedIndex >= 0 ? TOURS[tourId][savedIndex]?.id : TOURS[tourId][0]?.id,
          updatedAt: new Date().toISOString(),
        },
      },
    })
  }, [onboardingStatus, saveOnboardingStatus])

  const startSetup = useCallback(() => {
    setActiveTour(null)
    setPaused(false)
    void saveOnboardingStatus({ setup: 'in_progress' })
  }, [saveOnboardingStatus])

  const setSetupMode = useCallback((mode: OnboardingSetupMode) => {
    void saveOnboardingStatus({ setup: 'in_progress', setup_mode: mode })
  }, [saveOnboardingStatus])

  const setSampleAccountId = useCallback(async (accountId: string | null) => {
    await saveOnboardingStatus({ setup: 'in_progress', sample_account_id: accountId })
  }, [saveOnboardingStatus])

  const completeSetup = useCallback(async (mode: OnboardingSetupMode, sampleAccountId?: string | null) => {
    await saveOnboardingStatus({
      setup: 'completed',
      setup_mode: mode,
      sample_account_id: sampleAccountId ?? onboardingStatus?.sample_account_id ?? null,
      current_tour: null,
      current_step_id: null,
    })
    startTour('onboarding')
  }, [onboardingStatus?.sample_account_id, saveOnboardingStatus, startTour])

  const cleanupSampleWorkspace = useCallback(async () => {
    const sampleAccountId = onboardingStatus?.sample_account_id
    if (!sampleAccountId) return true

    try {
      const response = await fetch('/api/v1/onboarding/sample-workspace', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: sampleAccountId }),
      })
      if (!response.ok) throw new Error('Sample workspace cleanup failed')
      clearAccountsCache()
      setCleanupError(null)
      await saveOnboardingStatus({ sample_account_id: null })
      return true
    } catch (error) {
      setCleanupError('The sample workspace could not be removed yet.')
      reportError(error, { surface: 'client', operation: 'cleanup-onboarding-sample-workspace' })
      return false
    }
  }, [onboardingStatus?.sample_account_id, saveOnboardingStatus])

  const retrySampleCleanup = useCallback(async () => {
    await cleanupSampleWorkspace()
  }, [cleanupSampleWorkspace])

  const skipSetup = useCallback(async () => {
    const cleanupSucceeded = await cleanupSampleWorkspace()
    await saveOnboardingStatus({
      setup: 'skipped',
      current_tour: null,
      current_step_id: null,
      ...(cleanupSucceeded ? { sample_account_id: null } : {}),
    })
  }, [cleanupSampleWorkspace, saveOnboardingStatus])

  const skipTour = useCallback(async () => {
    if (!activeTour) return
    const tourId = canonicalTourId(activeTour)
    const isCore = tourId === 'onboarding'

    const cleanupSucceeded = isCore ? await cleanupSampleWorkspace() : true
    if (tourId === 'onboarding') {
      await saveOnboardingStatus({
        setup: 'skipped',
        current_tour: null,
        current_step_id: null,
        ...(cleanupSucceeded ? { sample_account_id: null } : {}),
      })
    } else {
      const next = updateTourProgress(onboardingStatus, tourId as Exclude<TourId, 'onboarding'>, 'skipped')
      await saveOnboardingStatus(next)
    }
    setActiveTour(null)
    setPaused(false)
    toast.success('Tour paused. You can resume it from the getting-started checklist.')
  }, [activeTour, cleanupSampleWorkspace, onboardingStatus, saveOnboardingStatus])

  const completeTour = useCallback(async () => {
    if (!activeTour) return
    const tourId = canonicalTourId(activeTour)
    if (tourId === 'onboarding') {
      const cleanupSucceeded = await cleanupSampleWorkspace()
      await saveOnboardingStatus({
        setup: 'completed',
        current_tour: null,
        current_step_id: null,
        ...(cleanupSucceeded ? { sample_account_id: null } : {}),
      })
    } else {
      const next = updateTourProgress(onboardingStatus, tourId as Exclude<TourId, 'onboarding'>, 'completed')
      await saveOnboardingStatus(next)
    }
    setActiveTour(null)
    setPaused(false)
    toast.success(tourId === 'onboarding' ? 'Setup complete.' : 'Tour complete.')
  }, [activeTour, cleanupSampleWorkspace, onboardingStatus, saveOnboardingStatus])

  const nextStep = useCallback(() => {
    if (!activeTour || !currentSteps.length) return
    const nextIndex = stepIndex + 1
    if (nextIndex < currentSteps.length) {
      setStepIndex(nextIndex)
      void saveOnboardingStatus({
        current_tour: activeTour,
        current_step_id: currentSteps[nextIndex]?.id ?? null,
        tours: {
          [activeTour]: {
            state: 'in_progress',
            currentStepId: currentSteps[nextIndex]?.id,
            updatedAt: new Date().toISOString(),
          },
        },
      })
    } else {
      void completeTour()
    }
  }, [activeTour, completeTour, currentSteps, saveOnboardingStatus, stepIndex])

  const prevStep = useCallback(() => {
    if (!activeTour || stepIndex <= 0) return
    const previousStep = currentSteps[stepIndex - 1]
    setStepIndex(stepIndex - 1)
    void saveOnboardingStatus({
      current_tour: activeTour,
      current_step_id: previousStep?.id ?? null,
      tours: {
        [activeTour]: {
          state: 'in_progress',
          currentStepId: previousStep?.id,
          updatedAt: new Date().toISOString(),
        },
      },
    })
  }, [activeTour, currentSteps, saveOnboardingStatus, stepIndex])

  const pauseTour = useCallback(() => setPaused(true), [])
  const resumeTour = useCallback(() => {
    setPaused(false)
    if (currentStep?.route && pathname !== currentStep.route) router.push(currentStep.route as Route)
  }, [currentStep?.route, pathname, router])

  const navigateForTour = useCallback((route: string) => router.push(route as Route), [router])
  const target = useTourTargetVisibility({
    activeTour,
    currentStep,
    paused,
    pathname,
    isMobile,
    stepIndex,
    navigate: navigateForTour,
    nextStep,
    pauseTour,
  })
  useTourActionAdvance({
    activeTour,
    currentStep,
    paused,
    isTargetVisible: target.isTargetVisible,
    nextStep,
  })

  const onboardingOpen = Boolean(
    pathname === '/dashboard' &&
    onboardingStatus &&
    onboardingStatus.setup !== 'completed' &&
    onboardingStatus.setup !== 'skipped' &&
    activeTour === null,
  )

  const value = useMemo<TourContextType>(() => ({
    activeTour,
    stepIndex,
    currentStep,
    paused,
    onboardingStatus,
    onboardingOpen,
    cleanupError,
    startTour,
    startSetup,
    setSetupMode,
    setSampleAccountId,
    completeSetup,
    skipSetup,
    nextStep,
    prevStep,
    skipTour,
    completeTour,
    resumeTour,
    pauseTour,
    retryTarget: target.retryTarget,
    retrySampleCleanup,
    isTargetVisible: target.isTargetVisible,
    isLoadingTarget: target.isLoadingTarget,
    targetMissing: target.targetMissing,
    totalSteps: currentSteps.length,
  }), [
    activeTour, cleanupError, completeSetup, completeTour, currentStep, currentSteps.length,
    onboardingOpen, onboardingStatus, paused, nextStep, pauseTour, prevStep, retrySampleCleanup,
    resumeTour, setSetupMode, skipSetup, skipTour, startSetup, startTour, stepIndex,
    setSampleAccountId, target.isLoadingTarget, target.isTargetVisible, target.retryTarget, target.targetMissing,
  ])

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>
}

export const useTour = () => {
  const context = useContext(TourContext)
  if (!context) throw new Error('useTour must be used within a TourProvider')
  return context
}
