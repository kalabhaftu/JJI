'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { TourId, TourStep } from '@/lib/tours/types'
import { TOUR_EVENT } from '@/lib/tours/events'

interface TourTargetInput {
  activeTour: TourId | null
  currentStep: TourStep | null
  paused: boolean
  pathname: string
  isMobile: boolean
  stepIndex: number
  navigate: (route: string) => void
  nextStep: () => void
  pauseTour: () => void
}

export function useTourTargetVisibility(input: TourTargetInput) {
  const {
    activeTour,
    currentStep,
    paused,
    pathname,
    isMobile,
    navigate,
  } = input
  const [isTargetVisible, setIsTargetVisible] = useState(false)
  const [isLoadingTarget, setIsLoadingTarget] = useState(false)
  const [targetMissing, setTargetMissing] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const checkInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  const retryTarget = useCallback(() => {
    setTargetMissing(false)
    setIsTargetVisible(false)
    setRetryCount((count) => count + 1)
  }, [])

  useEffect(() => {
    if (!activeTour || !currentStep || paused) {
      setIsTargetVisible(false)
      setIsLoadingTarget(false)
      return
    }

    if (currentStep.route && pathname !== currentStep.route) {
      setIsLoadingTarget(true)
      setTargetMissing(false)
      navigate(currentStep.route)
      return
    }

    if (currentStep.desktopOnly && isMobile) {
      setIsTargetVisible(true)
      setIsLoadingTarget(false)
      return
    }

    if (!currentStep.targetSelector) {
      setIsTargetVisible(true)
      setIsLoadingTarget(false)
      setTargetMissing(false)
      return
    }

    setIsTargetVisible(false)
    setIsLoadingTarget(true)
    setTargetMissing(false)
    let attempts = 0
    checkInterval.current = setInterval(() => {
      attempts += 1
      if (document.querySelector(currentStep.targetSelector!)) {
        setIsTargetVisible(true)
        setIsLoadingTarget(false)
        setTargetMissing(false)
        if (checkInterval.current) clearInterval(checkInterval.current)
        checkInterval.current = null
      } else if (attempts >= 30) {
        if (checkInterval.current) clearInterval(checkInterval.current)
        checkInterval.current = null
        setIsLoadingTarget(false)
        setTargetMissing(true)
      }
    }, 300)

    return () => {
      if (checkInterval.current) clearInterval(checkInterval.current)
      checkInterval.current = null
    }
  }, [activeTour, currentStep, paused, pathname, isMobile, navigate, retryCount])

  return { isTargetVisible, isLoadingTarget, targetMissing, retryTarget }
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
    if (!activeTour || !currentStep || paused || !isTargetVisible || !currentStep.completion) return
    if (currentStep.completion.type === 'route') return

    const { type, key } = currentStep.completion
    let fired = false

    const handleTourEvent = (event: Event) => {
      if (fired) return
      const detail = (event as CustomEvent<{ key?: string }>).detail
      if (detail?.key !== key) return
      fired = true
      window.setTimeout(nextStep, 180)
    }

    const handleInput = (event: Event) => {
      if (type !== 'value' || fired) return
      const target = event.target as HTMLInputElement | null
      if (!target || !target.matches(key) || !target.value.trim()) return
      fired = true
      window.setTimeout(nextStep, 180)
    }

    const handleSelectorClick = (event: Event) => {
      if (type !== 'selector' || fired) return
      const target = event.target as Element | null
      if (!target?.closest(key)) return
      fired = true
      window.setTimeout(nextStep, 180)
    }

    document.addEventListener(TOUR_EVENT, handleTourEvent)
    document.addEventListener('input', handleInput, true)
    document.addEventListener('click', handleSelectorClick, true)
    return () => {
      document.removeEventListener(TOUR_EVENT, handleTourEvent)
      document.removeEventListener('input', handleInput, true)
      document.removeEventListener('click', handleSelectorClick, true)
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
      if (currentStep?.completion?.key === 'account.created') nextStep()
    }
    document.addEventListener('jji-account-created', handleAccountCreated)
    return () => document.removeEventListener('jji-account-created', handleAccountCreated)
  }, [createdAccountId, currentStep, nextStep, setCreatedAccountId, setCreatedAccountType])
}
