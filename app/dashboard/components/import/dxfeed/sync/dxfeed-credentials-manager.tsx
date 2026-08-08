'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { HugeiconsIcon } from '@hugeicons/react'
import { Loading03Icon, Delete02Icon, Add01Icon, Refresh01Icon, MoreVerticalIcon, ChevronDownIcon, Alert02Icon } from '@hugeicons/core-free-icons'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import { useDxFeedSyncContext } from '@/context/dxfeed-sync-context'
import { reportError } from '@/lib/observability/report-error'
import { apiRequest } from '@/lib/api/client'
import { DIRECT_SYNC_STATUS, directSyncUnderDevelopmentMessage } from '@/lib/integrations/direct-sync-status'

export function DxFeedCredentialsManager() {
  const {
    performSyncForAccount,
    performSyncForAllAccounts,
    accounts,
    deleteAccount,
    loadAccounts,
  } = useDxFeedSyncContext()

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isTimeDialogOpen, setIsTimeDialogOpen] = useState(false)
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isReloading, setIsReloading] = useState(false)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [dailySyncTime, setDailySyncTime] = useState<string>('')
  const [isSavingTime, setIsSavingTime] = useState(false)

  const handleDelete = useCallback(
    async (accountId: string) => {
      try {
        await deleteAccount(accountId)
        setIsDeleteDialogOpen(false)
        toast.success(`Account ${accountId} deleted`)
      } catch (error) {
        toast.error(`Failed to delete account ${accountId}`)
        reportError(error, {
          surface: 'client',
          operation: 'delete-dxfeed-connection',
          entityId: accountId,
        })
      }
    },
    [deleteAccount],
  )

  const handleAddAccount = useCallback(async () => {
    if (DIRECT_SYNC_STATUS.isPaused) {
      toast.info(directSyncUnderDevelopmentMessage('DxFeed'))
      return
    }

    if (!loginEmail || !loginPassword) {
      toast.error("Email and password are required")
      return
    }

    try {
      setIsLoading(true)
      const response = await apiRequest<{ success?: boolean; error?: string }>(
        '/api/v1/dxfeed/credentials',
        {
          method: 'POST',
          body: JSON.stringify({ login: loginEmail, password: loginPassword }),
        },
      )
      const result = response.data ?? {}

      if (result.error) {
        toast.error(result.error || 'Failed to save DxFeed credentials')
        return
      }

      toast.success("Successfully connected to DxFeed")
      setIsAddDialogOpen(false)
      setLoginEmail('')
      setLoginPassword('')
      await loadAccounts()
    } catch (error) {
      reportError(error, {
        surface: 'client',
        operation: 'connect-dxfeed',
        route: '/api/v1/dxfeed/credentials',
      })
      toast.error("Authentication failed. Check your credentials.")
    } finally {
      setIsLoading(false)
    }
  }, [loginEmail, loginPassword, loadAccounts])

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleString()
  }

  const handleReloadAccounts = useCallback(async () => {
    if (DIRECT_SYNC_STATUS.isPaused) return
    try {
      setIsReloading(true)
      await loadAccounts()
      toast.success("Accounts reloaded successfully")
    } catch (error) {
      toast.error("Failed to reload accounts")
      reportError(error, {
        surface: 'client',
        operation: 'reload-dxfeed-connections',
      })
    } finally {
      setIsReloading(false)
    }
  }, [loadAccounts])

  const handleSetDailySyncTime = useCallback(
    (accountId: string, currentTime: Date | null) => {
      setSelectedAccountId(accountId)
      if (currentTime) {
        const utcDate = new Date(currentTime)
        const localHours = utcDate.getHours().toString().padStart(2, '0')
        const localMinutes = utcDate.getMinutes().toString().padStart(2, '0')
        setDailySyncTime(`${localHours}:${localMinutes}`)
      } else {
        setDailySyncTime('')
      }
      setIsTimeDialogOpen(true)
    },
    [],
  )

  const handleSaveDailySyncTime = useCallback(async () => {
    if (!selectedAccountId) return

    try {
      setIsSavingTime(true)

      let utcTimeString: string | null = null
      if (dailySyncTime) {
        const parts = dailySyncTime.split(':')
        const hours = parts[0] ? Number(parts[0]) : 0
        const minutes = parts[1] ? Number(parts[1]) : 0
        const localDate = new Date()
        localDate.setHours(hours, minutes, 0, 0)
        utcTimeString = localDate.toISOString()
      }

      const response = await apiRequest<{ success: boolean; error?: string }>(
        '/api/v1/dxfeed/synchronizations/schedule',
        {
          method: 'PATCH',
          body: JSON.stringify({
            accountId: selectedAccountId,
            utcTimeString,
          }),
        },
      )
      const result = response.data ?? { success: false }

      if (result.success) {
        toast.success("Daily sync time updated")
        setIsTimeDialogOpen(false)
        await loadAccounts()
      } else {
        toast.error(result.error || "Failed to update daily sync time")
      }
    } catch (error) {
      toast.error("Failed to update daily sync time")
      reportError(error, {
        surface: 'client',
        operation: 'update-dxfeed-sync-time',
        entityId: selectedAccountId,
      })
    } finally {
      setIsSavingTime(false)
    }
  }, [selectedAccountId, dailySyncTime, loadAccounts])

  const handlePresetTime = useCallback((preset: string) => {
    let hours: number
    let minutes: number

    switch (preset) {
      case 'midday':
        hours = 12
        minutes = 0
        break
      case 'after-close': {
        const utcClose = new Date()
        utcClose.setUTCHours(22, 0, 0, 0)
        hours = utcClose.getHours()
        minutes = utcClose.getMinutes()
        break
      }
      case 'midnight':
        hours = 0
        minutes = 0
        break
      case 'morning':
        hours = 8
        minutes = 0
        break
      default:
        return
    }

    setDailySyncTime(
      `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
    )
  }, [])

  function formatSyncTime(date: Date | null) {
    if (!date) return "Not Set (Manual Only)"

    const utcDate = new Date(date)
    const localHours = utcDate.getHours().toString().padStart(2, '0')
    const localMinutes = utcDate.getMinutes().toString().padStart(2, '0')

    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'short',
    })
    const parts = formatter.formatToParts(new Date())
    const tzName = parts.find((part) => part.type === 'timeZoneName')?.value || ''

    return `${localHours}:${localMinutes} ${tzName}`
  }

  return (
    <div className="space-y-4">
      {DIRECT_SYNC_STATUS.isPaused && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200">
          <HugeiconsIcon icon={Alert02Icon} className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" strokeWidth={2} color="currentColor" />
          <div className="space-y-1">
            <p className="font-medium text-amber-950 dark:text-amber-100">
              DxFeed direct sync is currently paused
            </p>
            <p className="text-amber-800/90 dark:text-amber-200/90">
              {directSyncUnderDevelopmentMessage('DxFeed')}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Saved Accounts</h2>
            <Button
              onClick={handleReloadAccounts}
              size="sm"
              variant="tertiary"
              disabled={isReloading || DIRECT_SYNC_STATUS.isPaused}
              className="h-8 w-8 p-0"
            >
              {isReloading ? (
                <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin" strokeWidth={2} color="currentColor" />
              ) : (
                <HugeiconsIcon icon={Refresh01Icon} className="h-4 w-4" strokeWidth={2} color="currentColor" />
              )}
            </Button>
          </div>
          <div className="flex gap-2 items-center">
            <Button
              onClick={async () => {
                await performSyncForAllAccounts()
              }}
              size="sm"
              variant="secondary"
              disabled={syncingId !== null || DIRECT_SYNC_STATUS.isPaused}
              className="h-8"
            >
              <HugeiconsIcon icon={Refresh01Icon} className="h-4 w-4 mr-2" strokeWidth={2} color="currentColor" />
              Sync All
            </Button>
            <Button
              onClick={() => {
                if (DIRECT_SYNC_STATUS.isPaused) {
                  toast.info(directSyncUnderDevelopmentMessage('DxFeed'))
                  return
                }
                setIsAddDialogOpen(true)
              }}
              disabled={isLoading || DIRECT_SYNC_STATUS.isPaused}
              size="sm"
              className="h-8"
            >
              {isLoading ? (
                <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 mr-2 animate-spin" strokeWidth={2} color="currentColor" />
              ) : (
                <HugeiconsIcon icon={Add01Icon} className="h-4 w-4 mr-2" strokeWidth={2} color="currentColor" />
              )}
              Add New Account
            </Button>
          </div>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account Name</TableHead>
              <TableHead>Last Synced</TableHead>
              <TableHead>Daily Sync Time (Local)</TableHead>
              <TableHead>Connection Status</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((account) => (
              <TableRow key={account.accountId}>
                <TableCell className="font-medium">
                  {account.accountNumbers.length > 0 ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="tertiary" size="sm" className="h-auto px-2 py-1 text-left font-medium">
                          <span className="truncate max-w-[160px]">
                            {account.accountNumbers.length === 1
                              ? account.accountNumbers[0]
                              : `${account.accountNumbers.length} accounts`}
                          </span>
                          {account.accountNumbers.length > 1 && (
                            <HugeiconsIcon icon={ChevronDownIcon} className="ml-1 h-3 w-3 shrink-0 opacity-50" strokeWidth={2} color="currentColor" />
                          )}
                        </Button>
                      </PopoverTrigger>
                      {account.accountNumbers.length > 1 && (
                        <PopoverContent className="w-64 p-0" align="start">
                          <div className="px-3 py-2 border-b">
                            <p className="text-sm font-medium">Synced Accounts</p>
                          </div>
                          <ScrollArea className="max-h-[200px]">
                            <div className="p-2 space-y-1">
                              {account.accountNumbers.map((num) => (
                                <div
                                  key={num}
                                  className="px-2 py-1.5 text-sm rounded hover:bg-muted"
                                >
                                  {num}
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </PopoverContent>
                      )}
                    </Popover>
                  ) : (
                    <span className="text-muted-foreground text-sm">{account.accountId}</span>
                  )}
                </TableCell>
                <TableCell>{formatDate(account.lastSyncedAt.toISOString())}</TableCell>
                <TableCell>
                  <Button
                    variant="tertiary"
                    size="sm"
                    onClick={() =>
                      handleSetDailySyncTime(account.accountId, account.dailySyncTime)
                    }
                    className="text-xs"
                  >
                    {formatSyncTime(account.dailySyncTime)}
                  </Button>
                </TableCell>
                <TableCell>
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      account.hasToken
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }`}
                  >
                    {account.hasToken ? "Connected" : "Disconnected"}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex justify-center items-center gap-2">
                    {!account.hasToken && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsAddDialogOpen(true)}
                        className="h-8"
                      >
                        Reconnect
                      </Button>
                    )}
                    <Button
                      variant="tertiary"
                      size="sm"
                      onClick={async () => {
                        setSyncingId(account.accountId)
                        try {
                          await performSyncForAccount(account.accountId)
                        } finally {
                          setSyncingId(null)
                        }
                      }}
                      disabled={syncingId !== null || !account.hasToken || DIRECT_SYNC_STATUS.isPaused}
                      aria-label="Sync account"
                    >
                      {syncingId === account.accountId ? (
                        <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin" strokeWidth={2} color="currentColor" />
                      ) : (
                        <HugeiconsIcon icon={Refresh01Icon} className="h-4 w-4 text-muted-foreground" strokeWidth={2} color="currentColor" />
                      )}
                    </Button>
                    <Popover modal>
                      <PopoverTrigger asChild>
                        <Button variant="tertiary" size="sm" className="h-8 w-8 p-0" aria-label="More options">
                          <HugeiconsIcon icon={MoreVerticalIcon} className="h-4 w-4" strokeWidth={2} color="currentColor" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-48 p-2" align="end">
                        <div className="flex flex-col space-y-1">
                          <Button
                            variant="tertiary"
                            size="sm"
                            className="justify-start text-left text-destructive hover:text-destructive"
                            onClick={() => {
                              setSelectedAccountId(account.accountId)
                              setIsDeleteDialogOpen(true)
                            }}
                          >
                            <HugeiconsIcon icon={Delete02Icon} className="h-4 w-4 mr-2" strokeWidth={2} color="currentColor" />
                            Delete Connection
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {accounts.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                  No saved DxFeed accounts found. Click 'Add New Account' to connect.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect DxFeed Account</DialogTitle>
            <DialogDescription>Enter your DxFeed client credentials. Your login details are used directly to authenticate with DxFeed.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="dxfeed-email">Login Email / Username</Label>
              <Input
                id="dxfeed-email"
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="Enter your login email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dxfeed-password">Password</Label>
              <Input
                id="dxfeed-password"
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter your password"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="secondary" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddAccount} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 mr-2 animate-spin" strokeWidth={2} color="currentColor" />
                    Connecting...
                  </>
                ) : (
                  "Connect Account"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete DxFeed Account</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove the DxFeed connection for account {selectedAccountId}? This will disable auto sync.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2 mt-4">
            <Button variant="secondary" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedAccountId && handleDelete(selectedAccountId)}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {}
      <Dialog open={isTimeDialogOpen} onOpenChange={setIsTimeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scheduled Daily Sync</DialogTitle>
            <DialogDescription>
              Specify the time of day when you want your trades to automatically sync from DxFeed. Leave empty to disable auto sync.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="syncTime">Sync Time</Label>
              <Input
                id="syncTime"
                type="time"
                value={dailySyncTime}
                onChange={(e) => setDailySyncTime(e.target.value)}
                placeholder="Select time"
              />
              <p className="text-sm text-muted-foreground">
                Time is entered in your local time zone ({Intl.DateTimeFormat().resolvedOptions().timeZone}) and stored in UTC.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Quick Presets</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handlePresetTime('morning')}
                >
                  8:00 AM (Morning)
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handlePresetTime('midday')}
                >
                  12:00 PM (Midday)
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handlePresetTime('after-close')}
                >
                  US Close (5:00 PM EST)
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handlePresetTime('midnight')}
                >
                  12:00 AM (Midnight)
                </Button>
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="secondary" onClick={() => setIsTimeDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveDailySyncTime} disabled={isSavingTime}>
                {isSavingTime ? (
                  <>
                    <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 mr-2 animate-spin" strokeWidth={2} color="currentColor" />
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
