'use client'

import { formatDistanceToNow } from 'date-fns'
import { NotificationRow as Notification } from '@/lib/db/schema/users'
import {
  Check,
  Trash2,
  Trophy,
  XCircle,
  DollarSign,
  Bell,
  ChevronRight,
  AlertTriangle,
  ArrowRight,
  X,
  ShieldAlert,
  Download,
  TrendingUp,
  Megaphone,
  BarChart3,
  RefreshCw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { NotificationType } from '@/lib/db/schema/users';

interface NotificationItemProps {
  notification: Notification
  onMarkAsRead: (id: string) => void
  onDelete: (id: string) => void
  onAction: (notification: Notification) => void
}

const notificationIcons: Record<NotificationType, React.ReactNode> = {
  FUNDED_PENDING_APPROVAL: <Trophy className="h-4 w-4 text-primary" />,
  FUNDED_APPROVED: <Trophy className="h-4 w-4 text-long" />,
  FUNDED_DECLINED: <XCircle className="h-4 w-4 text-short" />,
  PHASE_TRANSITION_PENDING: <ArrowRight className="h-4 w-4 text-primary" />,
  PAYOUT_APPROVED: <DollarSign className="h-4 w-4 text-long" />,
  PAYOUT_REJECTED: <DollarSign className="h-4 w-4 text-short" />,
  SYSTEM: <Bell className="h-4 w-4 text-muted-foreground" />,
  RISK_ALERT: <ShieldAlert className="h-4 w-4 text-destructive" />,
  RISK_BREACH: <ShieldAlert className="h-4 w-4 text-destructive" />,
  IMPORT_STATUS: <Download className="h-4 w-4 text-primary" />,
  WEEKLY_PERFORMANCE: <BarChart3 className="h-4 w-4 text-long" />,
  STRATEGY_DEVIATION: <TrendingUp className="h-4 w-4 text-warning" />,
  SYSTEM_ANNOUNCEMENT: <Megaphone className="h-4 w-4 text-muted-foreground" />,
  TRADE_STATUS: <RefreshCw className="h-4 w-4 text-muted-foreground" />,
  RISK_DAILY_LOSS_80: <ShieldAlert className="h-4 w-4 text-warning" />,
  RISK_DAILY_LOSS_95: <ShieldAlert className="h-4 w-4 text-destructive" />,
  RISK_MAX_DRAWDOWN_80: <ShieldAlert className="h-4 w-4 text-warning" />,
  RISK_MAX_DRAWDOWN_95: <ShieldAlert className="h-4 w-4 text-destructive" />,
  IMPORT_PROCESSING: <Download className="h-4 w-4 text-primary animate-pulse" />,
  IMPORT_COMPLETE: <Download className="h-4 w-4 text-long" />,
  STRATEGY_SESSION_VIOLATION: <TrendingUp className="h-4 w-4 text-warning" />,
  FEEDBACK_REPLY: <Bell className="h-4 w-4 text-primary" />,
  PAYMENT_DUE_SOON: <DollarSign className="h-4 w-4 text-warning" />,
  PAYMENT_DUE_TODAY: <DollarSign className="h-4 w-4 text-warning" />,
  PAYMENT_OVERDUE: <AlertTriangle className="h-4 w-4 text-destructive" />,
  SUBSCRIPTION_EXPIRED: <XCircle className="h-4 w-4 text-destructive" />,
  PAYMENT_RECEIVED: <Check className="h-4 w-4 text-long" />,
  PAYMENT_FAILED: <XCircle className="h-4 w-4 text-destructive" />,
  ACCESS_RESTORED: <Check className="h-4 w-4 text-long" />,
  ADMIN_FREE_ACCESS_GRANTED: <Check className="h-4 w-4 text-long" />,
  ADMIN_FREE_ACCESS_REVOKED: <XCircle className="h-4 w-4 text-warning" />
}

const notificationColors: Record<NotificationType, string> = {
  FUNDED_PENDING_APPROVAL: 'border-l-primary',
  FUNDED_APPROVED: 'border-l-long',
  FUNDED_DECLINED: 'border-l-short',
  PHASE_TRANSITION_PENDING: 'border-l-primary',
  PAYOUT_APPROVED: 'border-l-long',
  PAYOUT_REJECTED: 'border-l-short',
  SYSTEM: 'border-l-muted-foreground',
  RISK_ALERT: 'border-l-destructive',
  RISK_BREACH: 'border-l-destructive',
  IMPORT_STATUS: 'border-l-primary',
  WEEKLY_PERFORMANCE: 'border-l-long',
  STRATEGY_DEVIATION: 'border-l-orange-500',
  SYSTEM_ANNOUNCEMENT: 'border-l-muted-foreground',
  TRADE_STATUS: 'border-l-muted-foreground',
  RISK_DAILY_LOSS_80: 'border-l-orange-500',
  RISK_DAILY_LOSS_95: 'border-l-destructive',
  RISK_MAX_DRAWDOWN_80: 'border-l-orange-500',
  RISK_MAX_DRAWDOWN_95: 'border-l-destructive',
  IMPORT_PROCESSING: 'border-l-primary',
  IMPORT_COMPLETE: 'border-l-long',
  STRATEGY_SESSION_VIOLATION: 'border-l-orange-500',
  FEEDBACK_REPLY: 'border-l-primary',
  PAYMENT_DUE_SOON: 'border-l-orange-500',
  PAYMENT_DUE_TODAY: 'border-l-orange-500',
  PAYMENT_OVERDUE: 'border-l-destructive',
  SUBSCRIPTION_EXPIRED: 'border-l-destructive',
  PAYMENT_RECEIVED: 'border-l-long',
  PAYMENT_FAILED: 'border-l-destructive',
  ACCESS_RESTORED: 'border-l-long',
  ADMIN_FREE_ACCESS_GRANTED: 'border-l-long',
  ADMIN_FREE_ACCESS_REVOKED: 'border-l-orange-500'
}

export function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
  onAction
}: NotificationItemProps) {
  const isActionable =
    notification.type === 'WEEKLY_PERFORMANCE' ||
    (notification.type === 'SYSTEM_ANNOUNCEMENT' && Boolean((notification.data as any)?.body)) ||
    (notification.actionRequired && (
    notification.type === 'FUNDED_PENDING_APPROVAL' ||
    notification.type === 'PHASE_TRANSITION_PENDING'
    ))
  const actionLabel = notification.type === 'WEEKLY_PERFORMANCE'
    ? 'Open review'
    : notification.type === 'SYSTEM_ANNOUNCEMENT'
      ? 'Read update'
      : 'Take Action'

  return (
    <article
      className={cn(
        "relative border p-4 transition-colors hover:bg-muted/50 group",
        notificationColors[notification.type as NotificationType],
        !notification.isRead && "bg-muted/30"
      )}
    >
      <Button
        variant="tertiary"
        size="icon"
        className="absolute right-2 top-2 h-7 w-7 text-muted-foreground opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
        onClick={(e) => {
          e.stopPropagation()
          onDelete(notification.id)
        }}
        aria-label="Delete notification"
        title="Delete notification"
      >
        <X className="h-3.5 w-3.5" />
      </Button>

      <div className="flex items-start gap-3 pr-6">
        <div className="shrink-0 mt-0.5">
          {notificationIcons[notification.type as NotificationType]}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className={cn(
                "text-sm line-clamp-1",
                !notification.isRead && "font-semibold"
              )}>
                {notification.title}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {notification.message}
              </p>
            </div>

            {!notification.isRead && (
              <div className="shrink-0 h-2 w-2 rounded-full bg-primary mt-1" />
            )}
          </div>

          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground">
              {notification.createdAt ? formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true }) : 'Just now'}
            </span>

            <div className="flex items-center gap-1">
              {isActionable && (
                <Button
                  variant="primary"
                  size="sm"
                  className="h-7 text-xs px-3"
                  onClick={(e) => {
                    e.stopPropagation()
                    onAction(notification)
                  }}
                >
                  {actionLabel}
                  <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              )}
              {!notification.isRead && (
                <Button
                  variant="tertiary"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={(e) => {
                    e.stopPropagation()
                    onMarkAsRead(notification.id)
                  }}
                >
                  <Check className="h-3 w-3 mr-1" />
                  Mark read
                </Button>
              )}
            </div>
          </div>

          {notification.type === 'FUNDED_DECLINED' && !!notification.data && (
            <div className="mt-2 p-2 bg-destructive/10 rounded text-xs">
              <div className="flex items-center gap-1 text-destructive">
                <AlertTriangle className="h-3 w-3" />
                <span className="font-medium">Decline reason:</span>
              </div>
              <p className="mt-1 text-muted-foreground">
                {(notification.data as any).reason || 'No reason provided'}
              </p>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
