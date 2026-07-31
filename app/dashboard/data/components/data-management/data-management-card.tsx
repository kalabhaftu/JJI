'use client'

import { Spinner } from '@/components/ui/spinner'
import { isFundedPhaseForEvaluation } from '@/lib/prop-firm/reporting'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { 
  Trash2, 
  AlertCircle, 
  Pencil, 
  Loader2,
  ChevronDown, 
  ChevronRight, 
  Upload,
  Download,
  Building2,
  User,
  BarChart2
} from "lucide-react"
import { 
  removeAccountsFromTradesAction, 
  renameAccountAction
} from "@/server/accounts"
import { toast } from 'sonner'
import { useSWRConfig } from 'swr'
import useSWR from 'swr'
import { Badge } from "@/components/ui/badge"
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { TradeType as Trade } from '@/lib/db/schema/trades';

import { AdvancedExportDialog } from './advanced-export-dialog'
import { ImportDialog } from './import-dialog'
import { DeleteAllDataDialog } from '@/components/data-management/delete-all-data-dialog'
import { useUserStore } from '@/store/user-store'
import { useSearchParams } from 'next/navigation'
import { DataManagementCardSkeleton } from '../data-page-skeleton'

type AccountWithTrades = {
  id: string
  number: string
  name: string
  displayName: string
  accountType: 'live' | 'prop-firm'
  tradeCount: number
  trades: Trade[]
  currentPhaseDetails?: {
    phaseNumber: number
    status: string
    phaseId: string
    masterAccountId?: string
  } | null
}

type GroupedAccount = {
  accountName: string
  propFirm: string
  accountType: 'live' | 'prop-firm'
  totalTrades: number
  masterAccountId?: string
  phases: Array<{
    id: string
    number: string
    displayName: string
    status: string
    tradeCount: number
    phaseDetails: any
    phaseId?: string
    currentPhase?: number
    evaluationType?: string
  }>
}

function isFundedPhase(evaluationType: string | undefined, phaseNumber: number | undefined): boolean {
  return isFundedPhaseForEvaluation(evaluationType || '', phaseNumber || 0)
}

function getPhaseDisplayLabel(evaluationType: string | undefined, phaseNumber: number | undefined): string {
  if (!phaseNumber) return 'Unknown'
  if (isFundedPhase(evaluationType, phaseNumber)) {
    return 'Funded'
  }
  return `Phase ${phaseNumber}`
}

// Custom fetcher for Data Management
const fetcher = (url: string) => fetch(url).then(res => res.json())

export function DataManagementCard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const user = useUserStore((state) => state.user)
  const [currentPage, setCurrentPage] = useState(1)
  const { mutate: globalMutate } = useSWRConfig()

  // Use dedicated, unfiltered API for Data Management
  const { data: accountsResponse, isLoading: accountsLoading, mutate: refetchAccounts } = useSWR(
    user?.id ? '/api/v1/data-management/accounts' : null,
    fetcher
  )
  const allAccounts = useMemo(() => accountsResponse?.data ?? [], [accountsResponse?.data])

  const [deleteLoading, setDeleteLoading] = useState(false)
  const [renameLoading, setRenameLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [renameAccountDialogOpen, setRenameAccountDialogOpen] = useState(false)
  const [accountToRename, setAccountToRename] = useState("")
  const [newAccountNumber, setNewAccountNumber] = useState("")
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([])
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteAllDataDialogOpen, setDeleteAllDataDialogOpen] = useState(false)
  const [expandedAccounts, setExpandedAccounts] = useState<Record<string, boolean>>({})

  // Group accounts by master account name - use tradeCount from server data
  const groupedAccounts = useMemo(() => {
    if (!allAccounts || accountsLoading) return []

    const grouped: Record<string, GroupedAccount> = {}

    allAccounts.forEach((account: any) => {
      const accountName = account.name

      // Use tradeCount directly from account (comes from server)
      const tradeCount = account.tradeCount || 0

      if (!grouped[accountName]) {
        grouped[accountName] = {
          accountName,
          propFirm: (account as any).propfirm || '',
          accountType: account.accountType,
          totalTrades: 0,
          masterAccountId: account.currentPhaseDetails?.masterAccountId,
          phases: []
        }
      }

      grouped[accountName].phases.push({
        id: account.id,
        number: account.number,
        displayName: account.displayName,
        status: account.status,
        tradeCount: tradeCount,
        phaseDetails: account.currentPhaseDetails,
        phaseId: account.currentPhaseDetails?.phaseId || account.number,
        currentPhase: account.currentPhase || account.currentPhaseDetails?.phaseNumber,
        evaluationType: (account.currentPhaseDetails as any)?.evaluationType
      })

      grouped[accountName].totalTrades += tradeCount
    })

    // Sort phases within each group by phase number
    Object.values(grouped).forEach(group => {
      group.phases.sort((a, b) => (a.currentPhase || 0) - (b.currentPhase || 0))
    })

    return Object.values(grouped)
  }, [allAccounts, accountsLoading])

  // Flat list for selection and deletion operations
  const accountsWithTrades = useMemo(() => {
    if (!allAccounts || accountsLoading) return []

    return allAccounts.map((account: any) => ({
      id: account.id,
      number: account.number,
      name: account.name,
      displayName: account.displayName,
      accountType: account.accountType,
      tradeCount: account.tradeCount || 0,
      trades: [],
      currentPhaseDetails: account.currentPhaseDetails
    }))
  }, [allAccounts, accountsLoading])

  const stats = useMemo(() => {
    const liveAccounts = groupedAccounts.filter(g => g.accountType === 'live')
    const propAccounts = groupedAccounts.filter(g => g.accountType === 'prop-firm')
    const totalTrades = groupedAccounts.reduce((sum, g) => sum + g.totalTrades, 0)

    return {
      totalAccounts: groupedAccounts.length,
      totalTrades,
      liveAccounts: liveAccounts.length,
      propAccounts: propAccounts.length,
      totalPhases: accountsWithTrades.length
    }
  }, [groupedAccounts, accountsWithTrades.length])

  const handleDeleteAccounts = useCallback(async () => {
    if (!user || selectedAccounts.length === 0) return

    let loadingToastId: string | number | undefined
    try {
      setDeleteLoading(true)
      loadingToastId = toast.loading("Deleting trades...")

      const accountsToDelete = selectedAccounts

      const uniqueAccountIds = new Set<string>()
      const accountsToDeleteData: Array<{id: string, endpoint: string, displayName: string}> = []

      for (const accountNumber of accountsToDelete) {
        const account = accountsWithTrades.find((acc: any) => acc.number === accountNumber)
        if (account) {
          let endpoint: string
          let accountId: string

          if (account.accountType === 'prop-firm') {
            accountId = account.currentPhaseDetails?.masterAccountId || account.id
            endpoint = `/api/v1/prop-firm/accounts/${accountId}`
          } else {
            accountId = account.id
            endpoint = `/api/v1/accounts/${accountId}`
          }

          if (!uniqueAccountIds.has(accountId)) {
            uniqueAccountIds.add(accountId)
            accountsToDeleteData.push({ id: accountId, endpoint, displayName: account.displayName })
          }
        }
      }

      for (const accountData of accountsToDeleteData) {
        const response = await fetch(accountData.endpoint, { method: 'DELETE' })
        if (!response.ok) {
          throw new Error(`Failed to delete account ${accountData.displayName}`)
        }
      }

      router.refresh()
      
      refetchAccounts()
      
      setSelectedAccounts([])
      toast.success("Accounts Deleted", {
        description: `Successfully deleted ${accountsToDelete.length} account(s).`,
      })
    } catch (error) {
      setError(error instanceof Error ? error : new Error('Failed to delete accounts'))

      // Dismiss loading toast before showing error
      if (loadingToastId) {
        toast.dismiss(loadingToastId)
      }

      toast.error("Error", {
        description: error instanceof Error ? error.message : "Failed to delete accounts. Please try again.",
      })
    } finally {
      setDeleteLoading(false)
      setDeleteDialogOpen(false)
    }
  }, [user, accountsWithTrades, selectedAccounts, refetchAccounts, router])

  const handleSelectAccount = useCallback((accountNumber: string) => {
    setSelectedAccounts((prev: string[]) =>
      prev.includes(accountNumber)
        ? prev.filter((acc: string) => acc !== accountNumber)
        : [...prev, accountNumber]
    )
  }, [])

  const handleSelectAll = useCallback(() => {
    const allAccountNumbers = accountsWithTrades.map((acc: any) => acc.number)
    if (selectedAccounts.length === allAccountNumbers.length) {
      setSelectedAccounts([])
    } else {
      setSelectedAccounts(allAccountNumbers)
    }
  }, [selectedAccounts.length, accountsWithTrades])

  const toggleExpandAccount = useCallback((accountName: string) => {
    setExpandedAccounts(prev => ({
      ...prev,
      [accountName]: !prev[accountName]
    }))
  }, [])

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'active': return 'outline'
      case 'funded': return 'default'
      case 'failed': return 'destructive'
      case 'passed': return 'secondary'
      default: return 'outline'
    }
  }

  const handleRenameAccount = useCallback(async () => {
    if (!user || !accountToRename || !newAccountNumber) return
    try {
      setRenameLoading(true)
      await renameAccountAction(accountToRename, newAccountNumber)
      await refetchAccounts()
      toast.success('Account renamed', {
        description: `${accountToRename} → ${newAccountNumber}`,
      })
      setRenameAccountDialogOpen(false)
      setAccountToRename("")
      setNewAccountNumber("")
    } catch (error) {
      toast.error('Rename failed', {
        description: error instanceof Error ? error.message : 'Please try again.',
      })
    } finally {
      setRenameLoading(false)
    }
  }, [user, accountToRename, newAccountNumber, refetchAccounts])

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <section className="border-y border-border/30 py-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">Accounts and backups</p>
              <h2 className="text-xl font-semibold tracking-tight">Manage account data</h2>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
              {[
                ['Groups', stats.totalAccounts],
                ['Phases', stats.totalPhases],
                ['Live', stats.liveAccounts],
                ['Trades', stats.totalTrades],
              ].map(([label, value]) => (
                <div key={label} className="border-l border-border/40 pl-3">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-1 font-mono text-lg font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ImportDialog />
            <AdvancedExportDialog />
            {selectedAccounts.length > 0 && (
              <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={deleteLoading}
                    className="border border-destructive/25"
                  >
                    {deleteLoading ? (
                      <Spinner className="h-4 w-4" />
                    ) : (
                      <>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete selected ({selectedAccounts.length})
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Delete {selectedAccounts.length} Account{selectedAccounts.length > 1 ? 's' : ''}?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete the selected account{selectedAccounts.length > 1 ? 's' : ''} and all associated trades. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAccounts}
                      disabled={deleteLoading}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deleteLoading ? "Deleting..." : "Delete selected accounts"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </section>

      {accountsLoading && <DataManagementCardSkeleton />}

      {!accountsLoading && accountsWithTrades.length > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-border/24 bg-muted/18 p-4">
          <div className="flex items-center gap-3">
            <Checkbox
              id="select-all"
              checked={selectedAccounts.length === accountsWithTrades.length && accountsWithTrades.length > 0}
              onCheckedChange={handleSelectAll}
            />
            <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
              Select All
            </label>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {selectedAccounts.length > 0 && (
              <span>{selectedAccounts.length} selected</span>
            )}
            <span>{stats.totalTrades} total trades</span>
          </div>
        </div>
      )}

      {!accountsLoading && groupedAccounts.length > 0 && (
        <div className="space-y-3">
          {groupedAccounts.map((group) => {
            const isExpanded = expandedAccounts[group.accountName] ?? true
            const hasMultiplePhases = group.phases.length > 1
            const isPropFirm = group.accountType === 'prop-firm'

            return (
              <div 
                key={group.accountName} 
                className="overflow-hidden rounded-[22px] border border-border/24 bg-card/92"
              >
                <button
                  type="button"
                  disabled={!hasMultiplePhases}
                  aria-expanded={hasMultiplePhases ? isExpanded : undefined}
                  aria-label={hasMultiplePhases ? `${isExpanded ? 'Collapse' : 'Expand'} ${group.accountName}` : group.accountName}
                  className={cn(
                    "w-full p-4 text-left transition-colors disabled:cursor-default",
                    hasMultiplePhases && "cursor-pointer hover:bg-muted/35"
                  )}
                  onClick={() => hasMultiplePhases && toggleExpandAccount(group.accountName)}
                >
                  <div className="flex items-center gap-3">
                    {hasMultiplePhases && (
                      <div className="text-muted-foreground">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </div>
                    )}
                    
                    <div className={cn(
                      "h-8 w-8 rounded-lg flex items-center justify-center",
                      isPropFirm ? "bg-primary/10" : "bg-long/10"
                    )}>
                      {isPropFirm ? (
                        <Building2 className="h-4 w-4 text-primary" />
                      ) : (
                        <User className="h-4 w-4 text-long" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold truncate">{group.accountName}</span>
                        {group.propFirm && (
                          <span className="text-xs text-muted-foreground">{group.propFirm}</span>
                        )}
                        <Badge variant="outline" className="h-5 border-border/16 px-1.5 text-[10px] uppercase tracking-wide">
                          {isPropFirm ? 'Prop Firm' : 'Live'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <BarChart2 className="h-3 w-3" />
                          {group.totalTrades} trades
                        </span>
                        {hasMultiplePhases && (
                          <span>{group.phases.length} phases</span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>

                {(isExpanded || !hasMultiplePhases) && (
                  <div className="divide-y divide-border/16 border-t border-border/18">
                    {group.phases.map((phase) => (
                      <div
                        key={phase.id}
                        className="flex items-center gap-4 p-4 pl-6 transition-colors hover:bg-muted/20"
                      >
                        <Checkbox
                          checked={selectedAccounts.includes(phase.number)}
                          onCheckedChange={() => handleSelectAccount(phase.number)}
                        />
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm">{phase.number}</span>
                            {phase.currentPhase && (
                            <Badge variant="outline" className="border-border/16 text-xs">
                              {getPhaseDisplayLabel(phase.evaluationType, phase.currentPhase)}
                            </Badge>
                          )}
                            <Badge 
                              variant={getStatusVariant(phase.status)} 
                              className="text-xs capitalize"
                            >
                              {phase.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {phase.tradeCount} trade{phase.tradeCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Rename account ${phase.number}`}
                          title="Rename account"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation()
                            setAccountToRename(phase.number)
                            setNewAccountNumber(phase.number)
                            setRenameAccountDialogOpen(true)
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!accountsLoading && accountsWithTrades.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border/45 bg-card/30 py-16 text-center">
          <BarChart2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-2">No accounts yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first account from the Accounts page
          </p>
          <Button variant="outline" onClick={() => router.push('/dashboard/accounts')}>
            Go to Accounts
          </Button>
        </div>
      )}

      <div className="rounded-2xl border border-dashed border-destructive/24 bg-destructive/5 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">Danger Zone</h3>
            <p className="text-sm text-muted-foreground">
              Destructive actions live here so routine cleanup and backups stay separate.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setDeleteAllDataDialogOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete All Data
          </Button>
        </div>
      </div>
      <DeleteAllDataDialog 
        open={deleteAllDataDialogOpen} 
        onOpenChange={setDeleteAllDataDialogOpen} 
      />

      <Dialog open={renameAccountDialogOpen} onOpenChange={setRenameAccountDialogOpen}>
        <DialogContent onOpenAutoFocus={(event) => event.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Rename Account</DialogTitle>
            <DialogDescription>
              Change the account number. This will update all trade references.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleRenameAccount() }}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="currentNumber">Current Number</Label>
                <Input
                  id="currentNumber"
                  value={accountToRename}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newNumber">New Number</Label>
                <Input
                  id="newNumber"
                  value={newAccountNumber}
                  onChange={(e) => setNewAccountNumber(e.target.value)}
                  placeholder="Enter new account number"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setRenameAccountDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={renameLoading || !newAccountNumber || newAccountNumber === accountToRename}>
                {renameLoading ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4" />
                    Renaming...
                  </>
                ) : (
                  'Rename'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
