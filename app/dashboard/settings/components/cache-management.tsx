'use client'

import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { formatTimeInZone } from '@/lib/time-utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import {
  clearAllCaches,
  clearAccountCaches,
  getCacheStats
} from '@/lib/cache/persistent-cache'
import { queryKeyPrefixes } from '@/lib/query/query-keys'
import { useQueryScope } from '@/lib/query/use-query-scope'
import { Trash2 as Trash, Info, CheckCircle2 as CheckCircle } from "lucide-react"
import { toast } from 'sonner'
import { reportClientError } from '@/lib/observability/report-error'

export function CacheManagement({ plain = false }: { plain?: boolean }) {
  const [isClearing, setIsClearing] = useState(false)
  const [lastCleared, setLastCleared] = useState<Date | null>(null)
  const queryClient = useQueryClient()
  const scope = useQueryScope()
  const [stats, setStats] = useState({
    version: '0',
    localStorageSize: 0,
    localStorageKeys: 0,
    sessionStorageKeys: 0
  })

  useEffect(() => {
    setStats(getCacheStats())
  }, [])

  const handleClearAccountCache = async () => {
    setIsClearing(true)

    try {
      const cleared = clearAccountCaches()
      await queryClient.invalidateQueries({ queryKey: queryKeyPrefixes.accounts(scope) })
      await queryClient.invalidateQueries({ queryKey: queryKeyPrefixes.dataManagementAccounts(scope) })

      toast.success('Account cache cleared', {
        description: `Cleared ${cleared} cached items. Data will refresh automatically.`
      })

      setLastCleared(new Date())
      setStats(getCacheStats())
    } catch (error) {
      reportClientError(error, { operation: 'clear-account-cache', route: '/dashboard/settings' })
      toast.error('Failed to clear cache', {
        description: 'Please try again or contact support if the issue persists.'
      })
    } finally {
      setIsClearing(false)
    }
  }

  const handleClearAllCache = async () => {
    setIsClearing(true)

    try {
      const result = await clearAllCaches({
        keepTheme: true,
        keepConsent: true,
        clearServiceWorker: false,
        clearIndexedDB: false
      })

      await queryClient.invalidateQueries({ queryKey: queryKeyPrefixes.accounts(scope) })
      await queryClient.invalidateQueries({ queryKey: queryKeyPrefixes.dataManagementAccounts(scope) })

      const total = result.localStorage + result.sessionStorage + result.serviceWorker + result.indexedDB

      toast.success('All caches cleared', {
        description: `Cleared ${total} cached items. Page will reload to apply changes.`
      })

      setLastCleared(new Date())

      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (error) {
      reportClientError(error, { operation: 'clear-all-caches', route: '/dashboard/settings' })
      toast.error('Failed to clear all caches', {
        description: 'Please try again or contact support if the issue persists.'
      })
      setIsClearing(false)
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const content = (
    <div className="space-y-6">
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Current Cache Status</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Cache Version</p>
            <p className="font-mono">{stats.version}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Storage Size</p>
            <p className="font-mono">{formatBytes(stats.localStorageSize * 2)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Cached Keys</p>
            <p className="font-mono">{stats.localStorageKeys} items</p>
          </div>
          <div>
            <p className="text-muted-foreground">Session Data</p>
            <p className="font-mono">{stats.sessionStorageKeys} items</p>
          </div>
        </div>
      </div>

      <Alert className="border-border/40 bg-muted/15">
        <Info className="h-4 w-4" />
        <AlertDescription>
          The app automatically clears stale caches when detecting version changes.
          Only use manual clearing if you&apos;re experiencing issues with outdated data.
        </AlertDescription>
      </Alert>

      {lastCleared && (
        <div className="flex items-center gap-2 text-sm text-profit">
          <CheckCircle className="h-4 w-4" />
          <span>
            Cache cleared at {formatTimeInZone(lastCleared, 'HH:mm')} NY
          </span>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Clear Account Cache</p>
            <p className="text-xs text-muted-foreground">
              Clears cached account and trade data
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleClearAccountCache}
            disabled={isClearing}
          >
            {isClearing ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <Trash className="h-4 w-4" />
            )}
            <span className="ml-2">Clear</span>
          </Button>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-border/35">
          <div>
            <p className="text-sm font-medium">Clear All Cache</p>
            <p className="text-xs text-muted-foreground">
              Clears all cached data (theme and preferences preserved)
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleClearAllCache}
            disabled={isClearing}
          >
            {isClearing ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <Trash className="h-4 w-4" />
            )}
            <span className="ml-2">Clear All</span>
          </Button>
        </div>
      </div>

      <div className="text-xs text-muted-foreground/85 space-y-1">
        <p><strong>When to clear cache:</strong></p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Seeing outdated account balances or trade data</li>
          <li>Dashboard layout not updating correctly</li>
          <li>App behaving unexpectedly after an update</li>
          <li>Experiencing performance issues</li>
        </ul>
      </div>
    </div>
  )

  if (plain) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-base font-semibold">Cache Management</h3>
          <p className="text-xs text-muted-foreground/85">
            Clear cached data to resolve display issues or free up space
          </p>
        </div>
        {content}
      </div>
    )
  }

  return (
    <Card className="border-border/40 bg-card/70">
      <CardHeader>
        <CardTitle>Cache Management</CardTitle>
        <CardDescription className="text-muted-foreground/85">
          Clear cached data to resolve display issues or free up space
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {content}
      </CardContent>
    </Card>
  )
}
