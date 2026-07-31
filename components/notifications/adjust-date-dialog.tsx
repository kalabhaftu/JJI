'use client'

import { Spinner } from '@/components/ui/spinner'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Calendar, Loader2 as CircleNotch, Info } from 'lucide-react'
import { toast } from 'sonner'
import type { NotificationType, NotificationRow as Notification } from '@/lib/db/schema/users';


interface AdjustDateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  notification: Notification | null
  onComplete: () => void
}

export function AdjustDateDialog({
  open,
  onOpenChange,
  notification,
  onComplete
}: AdjustDateDialogProps) {
  const [isUpdating, setIsUpdating] = useState(false)

  if (!notification || !notification.data) return null

  const data = notification.data as any
  const accountId = data.accountId
  const newDate = data.newDate
  const isPropFirm = data.isPropFirm
  const formattedDate = new Date(newDate).toLocaleDateString()

  const handleAdjustDate = async () => {
    try {
      setIsUpdating(true)
      const response = await fetch(`/api/v1/accounts/${accountId}/adjust-date`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newDate,
          isPropFirm,
          notificationId: notification.id
        })
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Account date adjusted successfully')
        onComplete()
      } else {
        throw new Error(result.error || 'Failed to adjust date')
      }
    } catch (error) {
      toast.error('Adjustment failed', {
        description: error instanceof Error ? error.message : 'An error occurred'
      })
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Adjust Account Creation Date
          </DialogTitle>
          <DialogDescription>
            Your first trade is older than the account creation date.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
            <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Recommended Adjustment</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Setting the account creation date to <strong>{formattedDate}</strong> will ensure your performance statistics include all imported trades.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUpdating}
          >
            Not Now
          </Button>
          <Button
            onClick={handleAdjustDate}
            disabled={isUpdating}
            className="gap-2"
          >
            {isUpdating && <Spinner className="h-4 w-4" />}
            Accept Adjustment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
