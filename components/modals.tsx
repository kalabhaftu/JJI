'use client'

import React, { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useUserStore } from '@/store/user-store'
import LoadingOverlay from '../app/dashboard/components/loading-overlay'
import ImportButton from '../app/dashboard/components/import/import-button'
import OnboardingModal from './onboarding-modal'
import { useData } from '@/context/data-provider'


export default function Modals() {
  const user = useUserStore((state) => state.user)
  const isLoading = useUserStore((state) => state.isLoading)
  const { formattedTrades } = useData()
  const [isTradesDialogOpen, setIsTradesDialogOpen] = useState(false)
  const [showLoadingToast, setShowLoadingToast] = useState(false)
  const [hasTrades, setHasTrades] = useState<boolean | null>(null)
  const [isCheckingTrades, setIsCheckingTrades] = useState(false)

  // Debounce loading state to prevent flickering
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | undefined

    if (isLoading) {
      // Show loading toast after 500ms delay to avoid flickering on quick operations
      timeoutId = setTimeout(() => {
        setShowLoadingToast(true)
      }, 500)
    } else {
      setShowLoadingToast(false)
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [isLoading])

  // Close stale dialog as soon as trades are available
  useEffect(() => {
    if (formattedTrades.length > 0) {
      setHasTrades(true)
      setIsTradesDialogOpen(false)
    }
  }, [formattedTrades.length])

  // Verify actual trade existence from canonical unfiltered v1 endpoint
  useEffect(() => {
    if (!user?.id || isLoading || user.isFirstConnection) return

    let cancelled = false

    const checkTrades = async () => {
      setIsCheckingTrades(true)
      try {
        const response = await fetch(
          '/api/v1/trades?limit=1&pageLimit=1&pageOffset=0&includeStats=false&includeCalendar=false&includeWidgets=false',
          { cache: 'no-store' }
        )

        if (!response.ok) {
          throw new Error('Failed to check trade availability')
        }

        const data = await response.json()
        const total =
          typeof data?.total === 'number'
            ? data.total
            : Array.isArray(data?.trades)
              ? data.trades.length
              : 0

        if (!cancelled) {
          setHasTrades(total > 0)
        }
      } catch (error) {
        // Keep unknown state on request failure to avoid false "no trades" dialogs
        if (!cancelled) {
          setHasTrades(null)
        }
      } finally {
        if (!cancelled) {
          setIsCheckingTrades(false)
        }
      }
    }

    void checkTrades()

    return () => {
      cancelled = true
    }
  }, [user?.id, user?.isFirstConnection, isLoading])

  // Open only after data checks are complete and we can assert there are no trades
  useEffect(() => {
    if (isLoading || isCheckingTrades || user?.isFirstConnection) return

    if (hasTrades === false) {
      setIsTradesDialogOpen(true)
    } else if (hasTrades === true) {
      setIsTradesDialogOpen(false)
    }
  }, [hasTrades, isCheckingTrades, isLoading, user?.isFirstConnection])



  if (!user) return null
  return (
    <>
      {showLoadingToast && <LoadingOverlay />}
      <OnboardingModal />

      {!user?.isFirstConnection && (
        <Dialog open={isTradesDialogOpen} onOpenChange={setIsTradesDialogOpen}>
          <DialogContent>
            <DialogHeader>
            <DialogTitle>No Trades Found</DialogTitle>
            <DialogDescription>
              No trading data available. Import your trades to start analyzing your performance.
            </DialogDescription>
          </DialogHeader>
          <ImportButton />
        </DialogContent>
      </Dialog>
      )}


    </>
  )
}
