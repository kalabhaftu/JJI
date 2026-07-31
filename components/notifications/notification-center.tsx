'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  X,
  Filter,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { NotificationItem } from './notification-item'
import { NotificationRow as Notification, NotificationType } from '@/lib/db/schema/users'
import { FundedApprovalDialog } from '@/components/prop-firm/funded-approval-dialog'
import { PhaseTransitionApprovalDialog } from '@/components/prop-firm/phase-transition-approval-dialog'
import { AdjustDateDialog } from './adjust-date-dialog'
import { WeeklyReviewDialog } from './weekly-review-dialog'
import { toast } from 'sonner'

import { useDatabaseRealtime } from '@/lib/realtime/database-realtime'
import { useUserStore } from '@/store/user-store'
import { Spinner } from '@/components/ui/spinner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LexicalRenderer } from '@/components/ui/editor/lexical-renderer'

type FilterCategory = 'all' | 'alerts' | 'updates' | 'system'

const ALERT_TYPES: NotificationType[] = [
  'RISK_ALERT',
  'RISK_DAILY_LOSS_80',
  'RISK_DAILY_LOSS_95',
  'RISK_MAX_DRAWDOWN_80',
  'RISK_MAX_DRAWDOWN_95',
  'FUNDED_DECLINED',
  'PAYOUT_REJECTED',
]

const UPDATE_TYPES: NotificationType[] = [
  'FUNDED_PENDING_APPROVAL',
  'FUNDED_APPROVED',
  'PHASE_TRANSITION_PENDING',
  'PAYOUT_APPROVED',
  'IMPORT_STATUS',
  'IMPORT_PROCESSING',
  'IMPORT_COMPLETE',
  'WEEKLY_PERFORMANCE',
]

const SYSTEM_TYPES: NotificationType[] = [
  'SYSTEM',
  'SYSTEM_ANNOUNCEMENT',
]

const categories: { key: FilterCategory; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'alerts', label: 'Alerts' },
  { key: 'updates', label: 'Updates' },
  { key: 'system', label: 'System' },
]

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedFilter, setSelectedFilter] = useState<FilterCategory>('all')
  const user = useUserStore(state => state.user)
  const isDemo = typeof window !== 'undefined' && window.location.pathname.startsWith('/demo')

  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false)
  const [phaseTransitionDialogOpen, setPhaseTransitionDialogOpen] = useState(false)
  const [adjustDateDialogOpen, setAdjustDateDialogOpen] = useState(false)
  const [weeklyReviewDialogOpen, setWeeklyReviewDialogOpen] = useState(false)
  const [announcementDialogOpen, setAnnouncementDialogOpen] = useState(false)
  const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'disconnected' | 'error'>('disconnected')
  const [weeklyReviewId, setWeeklyReviewId] = useState<string | undefined>(undefined)
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null)

  const isOpenRef = useRef(isOpen)
  useEffect(() => {
    isOpenRef.current = isOpen
  }, [isOpen])

  const fetchNotifications = useCallback(async () => {
    if (!user?.id && !isDemo) {
      setIsLoading(false)
      return
    }
    if (isDemo || user?.id === 'demo-user') {
      setIsLoading(true)
      const demoNotifications: any[] = [
        {
          id: 'demo-notif-1',
          userId: 'demo-user',
          type: 'PHASE_TRANSITION_PENDING',
          title: 'Phase 1 Passed!',
          message: 'Congratulations! You have passed Phase 1 of your challenge. Ready to transition to Phase 2.',
          isRead: false,
          createdAt: new Date().toISOString()
        },
        {
          id: 'demo-notif-2',
          userId: 'demo-user',
          type: 'WEEKLY_PERFORMANCE',
          title: 'Weekly Review Ready',
          message: 'Your AI trading journal analysis for the last week is ready for review.',
          isRead: false,
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 'demo-notif-3',
          userId: 'demo-user',
          type: 'RISK_DAILY_LOSS_80',
          title: 'Risk Warning (80%)',
          message: 'You have reached 80% of your maximum daily loss limit on DEMO-123. Trade carefully.',
          isRead: true,
          createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
        }
      ]
      setNotifications(demoNotifications)
      setUnreadCount(2)
      setIsLoading(false)
      return
    }
    try {
      setIsLoading(true)
      const response = await fetch(`/api/v1/notifications?t=${Date.now()}`, {
        cache: 'no-store'
      })
      const result = await response.json()

      if (result.success) {
        setNotifications(result.data.notifications)
        setUnreadCount(result.data.unreadCount)
      }
    } catch (error) {
      // Silently fail - user sees empty notification state
    } finally {
      setIsLoading(false)
    }
  }, [user?.id, isDemo])

  const refreshUnreadCount = useCallback(async () => {
    if (isDemo) return
    if (!user?.id || user.id === 'demo-user') return
    try {
      const response = await fetch(`/api/v1/notifications?unreadOnly=true&limit=1&t=${Date.now()}`, {
        cache: 'no-store'
      })
      const result = await response.json()
      if (result.success) {
        setUnreadCount(result.data.unreadCount)
      }
    } catch (error) {
      // Silent fail
    }
  }, [user?.id, isDemo])

  useEffect(() => {
    if (!isDemo && (!user?.id || user.id === 'demo-user')) return
    fetchNotifications()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => {
    if (isOpen) {
      fetchNotifications()
    }
  }, [isOpen, fetchNotifications])

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isOpenRef.current && realtimeStatus !== 'connected') {
        refreshUnreadCount()
      }
    }, 180000)

    return () => clearInterval(interval)
  }, [refreshUnreadCount, realtimeStatus])

  useEffect(() => {
    const handleNotificationsRefresh = () => {
      if (isOpenRef.current) {
        fetchNotifications()
      } else {
        refreshUnreadCount()
      }
    }

    window.addEventListener('notifications:refresh', handleNotificationsRefresh)
    return () => window.removeEventListener('notifications:refresh', handleNotificationsRefresh)
  }, [fetchNotifications, refreshUnreadCount])

  useDatabaseRealtime({
    userId: user?.id,
    enabled: !!user?.id,
    onNotificationChange: (change) => {
      const notificationUserId = (change.newRecord?.userId || change.oldRecord?.userId) as string | undefined
      if (notificationUserId === user?.id) {
        if (change.event === 'INSERT' && change.newRecord) {
          const notification = change.newRecord as unknown as Notification
          setNotifications((prev) => {
            const withoutDuplicate = prev.filter((item) => item.id !== notification.id)
            return [notification, ...withoutDuplicate].slice(0, 50)
          })
          if (!notification.isRead) {
            setUnreadCount((prev) => prev + 1)
          }
        } else if (change.event === 'UPDATE' || change.event === 'DELETE') {
          if (isOpenRef.current) {
            fetchNotifications()
          } else {
            refreshUnreadCount()
          }
        }
      }
    },
    onStatusChange: (status) => {
      setRealtimeStatus(status)
      if (status === 'connected' && user?.id) {
        refreshUnreadCount()
      }
    },
  })

  const filteredNotifications = useMemo(() => {
    if (selectedFilter === 'all') return notifications
    const typeSet = selectedFilter === 'alerts' ? ALERT_TYPES
      : selectedFilter === 'updates' ? UPDATE_TYPES
      : SYSTEM_TYPES
    return notifications.filter(n => typeSet.includes(n.type as NotificationType))
  }, [notifications, selectedFilter])

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      if (isDemo || user?.id === 'demo-user') {
        setNotifications(prev =>
          prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
        )
        setUnreadCount(prev => Math.max(0, prev - 1))
        return
      }

      await fetch(`/api/v1/notifications/${notificationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead: true })
      })

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      toast.error('Failed to mark notification as read')
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      if (isDemo || user?.id === 'demo-user') {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
        setUnreadCount(0)
        toast.success('All notifications marked as read')
        return
      }

      await fetch('/api/v1/notifications', {
        method: 'PATCH'
      })

      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      setUnreadCount(0)
      toast.success('All notifications marked as read')
    } catch (error) {
      toast.error('Failed to mark all as read')
    }
  }

  const handleDelete = async (notificationId: string) => {
    try {
      if (isDemo || user?.id === 'demo-user') {
        setNotifications(prev => prev.filter(n => n.id !== notificationId))
        const deleted = notifications.find(n => n.id === notificationId)
        if (deleted && !deleted.isRead) {
          setUnreadCount(prev => Math.max(0, prev - 1))
        }
        toast.success('Notification deleted')
        return
      }

      await fetch(`/api/v1/notifications/${notificationId}`, {
        method: 'DELETE'
      })

      setNotifications(prev => prev.filter(n => n.id !== notificationId))
      const deleted = notifications.find(n => n.id === notificationId)
      if (deleted && !deleted.isRead) {
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
      toast.success('Notification deleted')
    } catch (error) {
      toast.error('Failed to delete notification')
    }
  }

  const handleClearAll = async () => {
    try {
      if (isDemo || user?.id === 'demo-user') {
        setNotifications([])
        setUnreadCount(0)
        toast.success('All notifications cleared')
        return
      }

      await fetch('/api/v1/notifications', { method: 'DELETE' })

      setNotifications([])
      setUnreadCount(0)
      toast.success('All notifications cleared')
    } catch (error) {
      toast.error('Failed to clear notifications')
    }
  }

  const handleNotificationAction = (notification: Notification) => {
    const openAfterPopoverCloses = (openDialog: () => void) => {
      setIsOpen(false)
      requestAnimationFrame(() => {
        openDialog()
      })
    }

    if (notification.type === 'FUNDED_PENDING_APPROVAL' && notification.actionRequired) {
      setSelectedNotification(notification)
      openAfterPopoverCloses(() => setApprovalDialogOpen(true))
    } else if (notification.type === 'PHASE_TRANSITION_PENDING' && notification.actionRequired) {
      setSelectedNotification(notification)
      openAfterPopoverCloses(() => setPhaseTransitionDialogOpen(true))
    } else if (notification.type === 'SYSTEM' && notification.actionRequired && notification.invalidationKey?.startsWith('adjust-date-')) {
      setSelectedNotification(notification)
      openAfterPopoverCloses(() => setAdjustDateDialogOpen(true))
    } else if (notification.type === 'WEEKLY_PERFORMANCE') {
      const data = notification.data as any
      openAfterPopoverCloses(() => {
        setWeeklyReviewId(data?.reviewId)
        setWeeklyReviewDialogOpen(true)
      })
      if (!notification.isRead) handleMarkAsRead(notification.id)
    } else if (notification.type === 'SYSTEM_ANNOUNCEMENT' && (notification.data as any)?.body) {
      setSelectedNotification(notification)
      openAfterPopoverCloses(() => setAnnouncementDialogOpen(true))
      if (!notification.isRead) handleMarkAsRead(notification.id)
    } else {
      if (!notification.isRead) {
        handleMarkAsRead(notification.id)
      }
    }
  }

  const handleApprovalComplete = () => {
    setApprovalDialogOpen(false)
    setSelectedNotification(null)
    fetchNotifications()
  }

  const handlePhaseTransitionComplete = () => {
    setPhaseTransitionDialogOpen(false)
    setSelectedNotification(null)
    fetchNotifications()
    setTimeout(() => {
      refreshUnreadCount()
    }, 500)
  }

  const handleAdjustDateComplete = () => {
    setAdjustDateDialogOpen(false)
    setSelectedNotification(null)
    fetchNotifications()
  }

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            className="relative inline-flex items-center justify-center rounded-full p-2 hover:bg-muted transition-colors"
            aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge
                variant="default"
                className="absolute -top-1 -right-1 text-xs px-1.5 py-0 min-w-[18px] h-[18px] flex items-center justify-center"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            )}
          </button>
        </PopoverTrigger>

        <PopoverContent
          className="w-[min(24rem,calc(100vw-1rem))] p-0 sm:w-96"
          align="end"
          side="bottom"
          sideOffset={8}
        >
          <div className="flex justify-between items-center border-b px-4 py-2">
            <h2 className="text-sm font-medium flex items-center gap-2">
              <Filter className="h-4 w-4" /> Notifications
            </h2>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={handleMarkAllAsRead}
                >
                  <CheckCheck className="h-3 w-3 mr-1" />
                  Read all
                </Button>
              )}
              {notifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs px-2 text-muted-foreground hover:text-destructive"
                  onClick={handleClearAll}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>

          <div className="flex gap-2 px-4 py-2 border-b overflow-x-auto">
            {categories.map((cat) => (
              <Button
                key={cat.key}
                variant={selectedFilter === cat.key ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs shrink-0"
                onClick={() => setSelectedFilter(cat.key)}
              >
                {cat.label}
              </Button>
            ))}
          </div>

          <ScrollArea className="h-[400px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner size="md" />
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Bell className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {selectedFilter === 'all'
                    ? 'All caught up!'
                    : `No ${selectedFilter} notifications`}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  We&apos;ll let you know when something happens
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredNotifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkAsRead={handleMarkAsRead}
                    onDelete={handleDelete}
                    onAction={handleNotificationAction}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      <FundedApprovalDialog
        open={approvalDialogOpen}
        onOpenChange={setApprovalDialogOpen}
        notification={selectedNotification}
        onComplete={handleApprovalComplete}
      />

      <PhaseTransitionApprovalDialog
        open={phaseTransitionDialogOpen}
        onOpenChange={setPhaseTransitionDialogOpen}
        notification={selectedNotification}
        onComplete={handlePhaseTransitionComplete}
      />

      <AdjustDateDialog
        open={adjustDateDialogOpen}
        onOpenChange={setAdjustDateDialogOpen}
        notification={selectedNotification}
        onComplete={handleAdjustDateComplete}
      />

      <WeeklyReviewDialog
        open={weeklyReviewDialogOpen}
        onOpenChange={(nextOpen) => {
          setWeeklyReviewDialogOpen(nextOpen)
          if (!nextOpen) {
            setWeeklyReviewId(undefined)
          }
        }}
        reviewId={weeklyReviewId}
      />

      <Dialog open={announcementDialogOpen} onOpenChange={setAnnouncementDialogOpen}>
        <DialogContent className="w-[min(100vw-1rem,48rem)] max-w-none rounded-[28px] border border-border/60">
          <DialogHeader>
            <DialogTitle>{selectedNotification?.title || 'Announcement'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {selectedNotification?.createdAt
                ? new Date(selectedNotification.createdAt).toLocaleString()
                : ''}
            </p>
            <div className="max-h-[60vh] overflow-y-auto rounded-2xl border border-border/50 bg-card p-4 sm:p-5">
              <LexicalRenderer
                value={String((selectedNotification?.data as any)?.body || selectedNotification?.message || '')}
                className="text-sm leading-7"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
