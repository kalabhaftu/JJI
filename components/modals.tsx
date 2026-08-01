'use client'

import React, { useEffect, useState } from 'react'
import LoadingOverlay from '../app/dashboard/components/loading-overlay'
import OnboardingShell from './onboarding-shell'
import { useUserStore } from '@/store/user-store'

export default function Modals() {
  const isLoading = useUserStore((state) => state.isLoading)
  const [showLoadingToast, setShowLoadingToast] = useState(false)

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    if (isLoading) timeoutId = setTimeout(() => setShowLoadingToast(true), 500)
    else setShowLoadingToast(false)
    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [isLoading])

  return (
    <>
      {showLoadingToast && <LoadingOverlay />}
      <OnboardingShell />
    </>
  )
}
