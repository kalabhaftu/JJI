'use client'

import { Spinner } from '@/components/ui/spinner'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  ChevronRight,
  Loader2,
  Sparkles,
  Trophy
} from "lucide-react"
import { toast } from "sonner"
import type { NotificationRow } from '@/lib/db/schema/users';

import { clearAccountsCache } from '@/hooks/use-accounts'
import { useData } from '@/context/data-provider'
import { isFundedPhaseForEvaluation } from '@/lib/prop-firm/reporting'

interface PhaseTransitionApprovalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  notification: NotificationRow | null
  onComplete: () => void
}

interface NotificationData {
  masterAccountId?: string
  phaseAccountId?: string
  accountName?: string
  propFirmName?: string
  currentPhaseNumber?: number
  nextPhaseNumber?: number
  evaluationType?: string
}

/**
 * Helper function to determine if a phase number represents the funded stage
 */
function isFundedPhase(evaluationType: string | undefined, phaseNumber: number): boolean {
  return isFundedPhaseForEvaluation(evaluationType || '', phaseNumber)
}

export function PhaseTransitionApprovalDialog({
  open,
  onOpenChange,
  notification,
  onComplete
}: PhaseTransitionApprovalDialogProps) {
  const router = useRouter()
  const { refreshTrades } = useData()
  const [nextPhaseId, setNextPhaseId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const notificationData = notification?.data as NotificationData | null

  const nextPhaseNumber = notificationData?.nextPhaseNumber || 2
  const evaluationType = notificationData?.evaluationType || 'Two Step'
  const isTransitioningToFunded = isFundedPhase(evaluationType, nextPhaseNumber)
  const nextPhaseName = isTransitioningToFunded ? 'Funded' : `Phase ${nextPhaseNumber}`

  const resetState = () => {
    setNextPhaseId('')
  }

  const handleClose = () => {
    if (!isSubmitting) {
      resetState()
      onOpenChange(false)
    }
  }

  const handleTransition = async () => {
    if (!nextPhaseId.trim()) {
      toast.error(`Please enter the ${nextPhaseName} account ID`)
      return
    }

    if (!notification || !notificationData?.masterAccountId) {
      toast.error('Invalid notification data')
      return
    }

    try {
      setIsSubmitting(true)

      const response = await fetch(`/api/v1/prop-firm/accounts/${notificationData.masterAccountId}/transition`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nextPhaseId: nextPhaseId.trim()
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to transition phase')
      }

      // Mark notification as resolved (delete it since action is complete)
      await fetch(`/api/v1/notifications/${notification.id}`, {
        method: 'DELETE'
      })

      // Close modal FIRST for immediate UI feedback
      onOpenChange(false)

      // Reset state synchronously before onComplete to ensure callback sees clean state
      resetState()

      toast.success(isTransitioningToFunded ? 'Congratulations!' : 'Phase Transition Complete!', {
        description: `Successfully transitioned to ${nextPhaseName}`,
        duration: 5000
      })

      clearAccountsCache()

      // Clear localStorage caches that might contain stale data
      try {
        localStorage.removeItem('settings-cache')
      } catch (e) {
        // Ignore storage errors
      }

      await refreshTrades()

      // Call onComplete callback - state is already reset, so callback sees clean state
      onComplete()

      // Force full page refresh after a small delay to allow modal to close
      setTimeout(() => {
        router.refresh()
      }, 100)

    } catch (error) {
      toast.error('Failed to transition phase', {
        description: error instanceof Error ? error.message : 'Please try again'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isTransitioningToFunded ? (
              <Trophy className="h-5 w-5 text-primary" />
            ) : (
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            )}
            {isTransitioningToFunded ? 'Ready for Funded Account!' : `Advance to ${nextPhaseName}`}
          </DialogTitle>
          <DialogDescription>
            {notificationData?.accountName
              ? `${notificationData.accountName} has passed Phase ${notificationData.currentPhaseNumber}`
              : 'Your account has passed the evaluation phase'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert className={isTransitioningToFunded ? "border-primary/50 bg-primary/10" : "border-muted"}>
            <Sparkles className={`h-4 w-4 ${isTransitioningToFunded ? 'text-primary' : 'text-muted-foreground'}`} />
            <AlertDescription>
              {isTransitioningToFunded
                ? "You've completed the evaluation! Enter your funded account ID."
                : `Enter your ${nextPhaseName} account ID to continue trading.`
              }
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="nextPhaseId">{nextPhaseName} Account ID</Label>
            <Input
              id="nextPhaseId"
              value={nextPhaseId}
              onChange={(e) => setNextPhaseId(e.target.value)}
              placeholder="e.g., 123456789"
              disabled={isSubmitting}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && nextPhaseId.trim()) {
                  handleTransition()
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Enter the account ID provided by {notificationData?.propFirmName || 'the prop firm'} for your {nextPhaseName.toLowerCase()} account
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1"
            >
              Later
            </Button>
            <Button
              onClick={handleTransition}
              disabled={isSubmitting || !nextPhaseId.trim()}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <Spinner className="h-4 w-4 mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  Activate {nextPhaseName}
                  <ChevronRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

