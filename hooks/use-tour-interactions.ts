'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import type { TourId, TourStep } from '@/lib/tours/types'

interface TourTargetInput {
  activeTour: TourId | null
  currentStep: TourStep | null
  paused: boolean
  pathname: string
  isMobile: boolean
  stepIndex: number
  navigate: (route: string) => void
  nextStep: () => void
  prevStep: () => void
  pauseTour: () => void
}

export function useTourTargetVisibility(input: TourTargetInput) {
  const {
    activeTour,
    currentStep,
    paused,
    pathname,
    isMobile,
    stepIndex,
    navigate,
    nextStep,
    prevStep,
    pauseTour,
  } = input
  const [isTargetVisible, setIsTargetVisible] = useState(false)
  const [isLoadingTarget, setIsLoadingTarget] = useState(false)
  const checkInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!activeTour || !currentStep || paused) {
      setIsTargetVisible(false)
      setIsLoadingTarget(false)
      return
    }
    if (currentStep.route && pathname !== currentStep.route) {
      setIsLoadingTarget(true)
      navigate(currentStep.route)
      return
    }
    if (currentStep.desktopOnly && isMobile) {
      nextStep()
      return
    }
    if (!currentStep.targetSelector) {
      setIsTargetVisible(true)
      setIsLoadingTarget(false)
      return
    }

    setIsTargetVisible(false)
    setIsLoadingTarget(true)
    let attempts = 0
    checkInterval.current = setInterval(() => {
      attempts++
      if (document.querySelector(currentStep.targetSelector!)) {
        setIsTargetVisible(true)
        setIsLoadingTarget(false)
        if (checkInterval.current) clearInterval(checkInterval.current)
        checkInterval.current = null
      } else if (attempts >= 15) {
        if (checkInterval.current) clearInterval(checkInterval.current)
        checkInterval.current = null
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
      if (checkInterval.current) clearInterval(checkInterval.current)
      checkInterval.current = null
    }
  }, [activeTour, currentStep, paused, pathname, isMobile, stepIndex, navigate, nextStep, prevStep, pauseTour])

  return { isTargetVisible, isLoadingTarget }
}

export function useTourActionAdvance(input: {
  activeTour: TourId | null
  currentStep: TourStep | null
  paused: boolean
  isTargetVisible: boolean
  nextStep: () => void
}) {
  const { activeTour, currentStep, paused, isTargetVisible, nextStep } = input
  useEffect(() => {
    if (!activeTour || !currentStep || paused || !isTargetVisible) return
    const { actionType, actionTarget } = currentStep
    if (!actionType || !actionTarget) return

    let fired = false
    const handleAction = (event: Event) => {
      if (fired) return
      const target = event.target as Element | null
      if (!target?.closest(actionTarget)) return
      fired = true
      setTimeout(nextStep, 305)
    }
    const events = actionType === 'click'
      ? ['click', 'mousedown', 'pointerdown']
      : ['input']
    for (const event of events) document.addEventListener(event, handleAction, { capture: true })
    return () => {
      for (const event of events) document.removeEventListener(event, handleAction, { capture: true })
    }
  }, [activeTour, currentStep, paused, isTargetVisible, nextStep])
}

export function useTourAccountCreatedEvent(input: {
  createdAccountId: string | null
  currentStep: TourStep | null
  nextStep: () => void
  setCreatedAccountId: (id: string) => void
  setCreatedAccountType: (type: 'live' | 'prop-firm') => void
}) {
  const {
    createdAccountId,
    currentStep,
    nextStep,
    setCreatedAccountId,
    setCreatedAccountType,
  } = input
  useEffect(() => {
    const handleAccountCreated = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        id?: string
        type?: 'live' | 'prop-firm'
      } | undefined
      if (!detail?.id || !detail.type || createdAccountId) return
      setCreatedAccountId(detail.id)
      setCreatedAccountType(detail.type)
      if (currentStep?.id === 'submit-account') nextStep()
    }
    document.addEventListener('jji-account-created', handleAccountCreated)
    return () => document.removeEventListener('jji-account-created', handleAccountCreated)
  }, [createdAccountId, currentStep, nextStep, setCreatedAccountId, setCreatedAccountType])
}
