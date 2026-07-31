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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Trophy,
  XCircle,
  CheckCircle2,
  Loader2,
  AlertCircle,
  PartyPopper
} from "lucide-react"
import { toast } from "sonner"
import {
  handleFundedApprovalAction,
  handleFundedDeclineAction
} from "@/server/notifications"
import type { NotificationRow } from '@/lib/db/schema/users';

import { clearAccountsCache } from '@/hooks/use-accounts'

interface FundedApprovalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  notification: NotificationRow | null
  onComplete: () => void
}

type Action = 'approved' | 'declined' | null

const DECLINE_REASONS = [
  { id: 'news_trading', label: 'News Trading Violation' },
  { id: 'consistency', label: 'Consistency Rule Violation' },
  { id: 'hidden_drawdown', label: 'Hidden Drawdown Breach' },
  { id: 'copy_trading', label: 'Copy Trading Violation' },
  { id: 'other', label: 'Other Reason' }
]

export function FundedApprovalDialog({
  open,
  onOpenChange,
  notification,
  onComplete
}: FundedApprovalDialogProps) {
  const router = useRouter()
  const [action, setAction] = useState<Action>(null)
  const [fundedAccountId, setFundedAccountId] = useState('')
  const [declineReason, setDeclineReason] = useState('')
  const [customReason, setCustomReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const notificationData = notification?.data as {
    masterAccountId?: string
    accountName?: string
  } | null

  const resetState = () => {
    setAction(null)
    setFundedAccountId('')
    setDeclineReason('')
    setCustomReason('')
  }

  const handleClose = () => {
    if (!isSubmitting) {
      resetState()
      onOpenChange(false)
    }
  }

  const handleApproval = async () => {
    if (!fundedAccountId.trim()) {
      toast.error('Please enter the funded account ID')
      return
    }

    if (!notification || !notificationData?.masterAccountId) {
      toast.error('Invalid notification data')
      return
    }

    try {
      setIsSubmitting(true)

      await handleFundedApprovalAction({
        notificationId: notification.id,
        masterAccountId: notificationData.masterAccountId,
        fundedAccountId: fundedAccountId.trim()
      })

      toast.success('Congratulations!', {
        description: 'Your funded account has been activated.',
        duration: 5000
      })

      clearAccountsCache()

      // Clear localStorage caches that might contain stale data
      try {
        localStorage.removeItem('settings-cache')
      } catch (e) {
        // Ignore storage errors
      }

      resetState()
      onComplete()

      router.refresh()

    } catch (error) {
      toast.error('Failed to process approval', {
        description: error instanceof Error ? error.message : 'Please try again'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDecline = async () => {
    if (!declineReason) {
      toast.error('Please select a reason')
      return
    }

    const reason = declineReason === 'other'
      ? customReason.trim() || 'Other reason'
      : DECLINE_REASONS.find(r => r.id === declineReason)?.label || declineReason

    if (!notification || !notificationData?.masterAccountId) {
      toast.error('Invalid notification data')
      return
    }

    try {
      setIsSubmitting(true)

      await handleFundedDeclineAction({
        notificationId: notification.id,
        masterAccountId: notificationData.masterAccountId,
        reason
      })

      toast.info('Account marked as declined', {
        description: 'The reason has been recorded in account history.'
      })

      clearAccountsCache()
      resetState()
      onComplete()
      router.refresh()

    } catch (error) {
      toast.error('Failed to process decline', {
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
            <Trophy className="h-5 w-5 text-primary" />
            Firm Approval Status
          </DialogTitle>
          <DialogDescription>
            {notificationData?.accountName
              ? `Update the status for ${notificationData.accountName}`
              : 'Update the firm approval status for your account'
            }
          </DialogDescription>
        </DialogHeader>

        {!action ? (
          <div className="space-y-4">
            <Alert>
              <PartyPopper className="h-4 w-4" />
              <AlertDescription>
                Your account met the profit target! What was the firm's decision?
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-24 flex-col gap-2 border-long/50 hover:border-long hover:bg-long/10"
                onClick={() => setAction('approved')}
              >
                <CheckCircle2 className="h-8 w-8 text-long" />
                <span className="text-sm font-medium">Firm Approved</span>
              </Button>

              <Button
                variant="outline"
                className="h-24 flex-col gap-2 border-destructive/50 hover:border-destructive hover:bg-destructive/10"
                onClick={() => setAction('declined')}
              >
                <XCircle className="h-8 w-8 text-destructive" />
                <span className="text-sm font-medium">Firm Declined</span>
              </Button>
            </div>
          </div>
        ) : action === 'approved' ? (
          <div className="space-y-4">
            <Alert className="border-long/50 bg-long/10">
              <CheckCircle2 className="h-4 w-4 text-long" />
              <AlertDescription>
                Great news! Enter your funded account ID to activate.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="fundedAccountId">Funded Account ID</Label>
              <Input
                id="fundedAccountId"
                value={fundedAccountId}
                onChange={(e) => setFundedAccountId(e.target.value)}
                placeholder="e.g., 123456789"
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                Enter the account ID provided by the prop firm for your funded account
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setAction(null)}
                disabled={isSubmitting}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleApproval}
                disabled={isSubmitting || !fundedAccountId.trim()}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <Spinner className="h-4 w-4 mr-2" />
                    Activating...
                  </>
                ) : (
                  'Activate Funded Account'
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                We're sorry to hear that. Please select the reason for decline.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <Label>Reason for Decline</Label>
              <RadioGroup
                value={declineReason}
                onValueChange={setDeclineReason}
                disabled={isSubmitting}
              >
                {DECLINE_REASONS.map((reason) => (
                  <div key={reason.id} className="flex items-center space-x-2">
                    <RadioGroupItem value={reason.id} id={reason.id} />
                    <Label htmlFor={reason.id} className="cursor-pointer text-sm">
                      {reason.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>

              {declineReason === 'other' && (
                <Textarea
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Please describe the reason..."
                  disabled={isSubmitting}
                  className="mt-2"
                />
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setAction(null)}
                disabled={isSubmitting}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={handleDecline}
                disabled={isSubmitting || !declineReason}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <Spinner className="h-4 w-4 mr-2" />
                    Processing...
                  </>
                ) : (
                  'Mark as Declined'
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

